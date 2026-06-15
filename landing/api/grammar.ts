import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAccessToken, extractBearer, corsHeaders } from "./_auth";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  if (req.method === "OPTIONS") {
    return res.status(204).set(headers).end();
  }
  if (req.method !== "POST") {
    return res.status(405).set(headers).json({ error: "Method not allowed" });
  }

  const token = extractBearer(req.headers.authorization);
  if (!token) {
    return res.status(401).set(headers).json({ error: "Missing Authorization header" });
  }

  try {
    await verifyAccessToken(token);
  } catch {
    return res.status(401).set(headers).json({ error: "Invalid token" });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(503).set(headers).json({ error: "Grammar service not configured" });
  }

  const body = req.body as {
    text: string;
    context?: string;
    writingStyle?: string;
    style?: string;
    preserveTone?: boolean;
    custom_vocabulary?: string[];
  };
  const { text, context, preserveTone } = body;
  const writingStyle = body.writingStyle ?? body.style;
  const customVocabulary = body.custom_vocabulary ?? [];

  if (!text || typeof text !== "string") {
    return res.status(400).set(headers).json({ error: "text is required" });
  }
  if (text.length > 50_000) {
    return res.status(413).set(headers).json({ error: "text exceeds maximum length of 50,000 characters" });
  }

  const stableCore = buildStableCore();
  const dynamicSuffix = buildDynamicSuffix(context, writingStyle, preserveTone, customVocabulary);

  const systemBlocks: Array<{ type: string; text: string; cache_control?: { type: string } }> = [
    { type: "text", text: stableCore, cache_control: { type: "ephemeral" } },
  ];
  if (dynamicSuffix) {
    systemBlocks.push({ type: "text", text: dynamicSuffix });
  }

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemBlocks,
        messages: [{ role: "user", content: text }],
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      return res.status(502).set(headers).json({ error: "Upstream error", detail: err });
    }

    const data = await upstream.json() as { content: Array<{ text: string }> };
    const raw = data.content?.[0]?.text ?? text;

    // Try to parse as structured JSON (Rust client sends structured prompt)
    try {
      const parsed = JSON.parse(raw) as {
        corrected?: string;
        changes?: unknown[];
        score?: number;
      };
      if (parsed.corrected) {
        return res.status(200).set(headers).json({
          corrected: parsed.corrected,
          changes: parsed.changes ?? [],
          score: parsed.score ?? 1.0,
        });
      }
    } catch {
      // Plain text response — wrap it
    }

    return res.status(200).set(headers).json({
      corrected: raw,
      changes: [],
      score: 1.0,
    });
  } catch {
    return res.status(502).set(headers).json({ error: "Grammar request failed" });
  }
}

function buildStableCore(): string {
  return [
    "You are a grammar correction assistant for legal and accounting professionals.",
    "Correct grammar, punctuation, and spelling in the user's dictated text.",
    'Respond ONLY with valid JSON: {"corrected": "...", "changes": [{"original": "...", "corrected": "...", "reason": "...", "category": "grammar|spelling|punctuation|style"}], "score": 0.95}',
    "Do not add or remove substantive content.",
  ].join(" ");
}

function buildDynamicSuffix(
  context?: string,
  writingStyle?: string,
  preserveTone?: boolean,
  customVocabulary?: string[],
): string {
  const style = writingStyle ?? "professional";
  const contextNote = context && context !== "general"
    ? `The text is for a ${context.replace(/_/g, " ")} context.`
    : "";
  const sanitizedVocab = customVocabulary
    ?.map((t) => t.replace(/[\n\r\t"'\\]/g, " ").trim().slice(0, 60))
    .filter((t) => t.length > 0 && t.length <= 60)
    .slice(0, 50);
  const vocabNote = sanitizedVocab && sanitizedVocab.length > 0
    ? `Preserve these domain-specific terms exactly as-is: ${sanitizedVocab.join(", ")}.`
    : "";
  const toneNote = preserveTone
    ? "Preserve the author's voice and tone exactly — only fix errors, do not rephrase."
    : "Improve clarity where appropriate while staying faithful to the meaning.";

  return [contextNote, vocabNote, `Writing style: ${style}.`, toneNote].filter(Boolean).join(" ");
}
