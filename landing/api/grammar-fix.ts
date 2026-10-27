import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { verifyAccessToken, extractBearer, corsHeaders, applyHeaders } from "./_auth.js";
import { checkEntitlement, entitlementDeniedBody } from "./_entitlement.js";
import {
  FixOutputSchema,
  MAX_TEXT_CHARS,
  PROMPT_VERSION,
  REWRITE_RATIO,
  SYSTEM_PROMPT,
  buildUserMessage,
  checkEdits,
  normalizeLocale,
  normalizeProtectedTerms,
} from "./_grammar-fix.js";

/**
 * POST /api/grammar-fix — proofread a span of the user's text and return the
 * edits that survive validation (see _grammar-fix.ts). Used by the iOS
 * keyboard's Fix button; the text is never logged or stored.
 *
 * Model and effort are server settings so they can change without an app
 * release: GRAMMAR_FIX_MODEL (default claude-opus-5-5), GRAMMAR_FIX_EFFORT
 * (default low — a keyboard waits on this call).
 */
const MODEL = process.env.GRAMMAR_FIX_MODEL || "claude-opus-5-5";
const EFFORT = (["low", "medium", "high"] as const).find((e) => e === process.env.GRAMMAR_FIX_EFFORT) ?? "low";
// Haiku has no server-side fallback model; sending `fallbacks` there is wrong.
const USE_FALLBACKS = !MODEL.startsWith("claude-haiku");

let client: Anthropic | null = null;
function anthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ timeout: 20_000, maxRetries: 1 });
  return client;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  if (req.method === "OPTIONS") {
    return applyHeaders(res, headers).status(204).end();
  }
  if (req.method !== "POST") {
    return applyHeaders(res, headers).status(405).json({ error: "Method not allowed" });
  }

  const token = extractBearer(req.headers.authorization);
  if (!token) {
    return applyHeaders(res, headers).status(401).json({ error: "Missing Authorization header" });
  }
  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    return applyHeaders(res, headers).status(401).json({ error: "Invalid token" });
  }
  const entitlement = await checkEntitlement(user);
  if (!entitlement.allowed) {
    return applyHeaders(res, headers).status(402).json(entitlementDeniedBody(entitlement));
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const text = body.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    return applyHeaders(res, headers).status(400).json({ error: "text is required" });
  }
  if (text.length > MAX_TEXT_CHARS) {
    return applyHeaders(res, headers)
      .status(413)
      .json({ error: `text exceeds maximum length of ${MAX_TEXT_CHARS} characters` });
  }
  const locale = normalizeLocale(body.locale);
  const protectedTerms = normalizeProtectedTerms(body.protected_terms ?? body.protectedTerms);

  const api = anthropic();
  if (!api) {
    return applyHeaders(res, headers).status(503).json({ error: "Grammar service not configured" });
  }

  let message;
  try {
    message = await api.beta.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(text, locale, protectedTerms) }],
      output_config: { effort: EFFORT, format: betaZodOutputFormat(FixOutputSchema) },
      ...(USE_FALLBACKS ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return applyHeaders(res, headers).status(429).json({ error: "Grammar service is busy — try again in a moment" });
    }
    if (error instanceof Anthropic.APIError) {
      return applyHeaders(res, headers).status(502).json({ error: "Grammar service error", status: error.status });
    }
    return applyHeaders(res, headers).status(502).json({ error: "Grammar request failed" });
  }

  if (message.stop_reason === "refusal") {
    return applyHeaders(res, headers).status(422).json({ error: "This text could not be checked" });
  }
  const output = message.parsed_output;
  if (!output) {
    return applyHeaders(res, headers).status(502).json({ error: "Grammar service returned no result" });
  }

  const check = checkEdits(text, output.edits, protectedTerms);
  return applyHeaders(res, headers).status(200).json({
    edits: check.accepted.map(({ original, replacement, category, reason }) => ({
      original,
      replacement,
      category,
      reason,
    })),
    dropped: check.rejected.length,
    rewrite_suspected: check.changedRatio > REWRITE_RATIO,
    model: message.model,
    prompt_version: PROMPT_VERSION,
  });
}
