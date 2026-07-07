import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAccessToken, extractBearer, corsHeaders, applyHeaders } from "./_auth.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ru: "Russian", ja: "Japanese",
  ko: "Korean", zh: "Chinese", ar: "Arabic", hi: "Hindi", tr: "Turkish",
  sv: "Swedish", da: "Danish", fi: "Finnish", no: "Norwegian", uk: "Ukrainian",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  if (req.method === "OPTIONS") return applyHeaders(res, headers).status(204).end();
  if (req.method !== "POST") return applyHeaders(res, headers).status(405).json({ error: "Method not allowed" });

  const token = extractBearer(req.headers.authorization);
  if (!token) return applyHeaders(res, headers).status(401).json({ error: "Missing Authorization header" });

  try {
    await verifyAccessToken(token);
  } catch {
    return applyHeaders(res, headers).status(401).json({ error: "Invalid token" });
  }

  if (!ANTHROPIC_API_KEY) {
    return applyHeaders(res, headers).status(503).json({ error: "Translation service not configured" });
  }

  const { text, target_language } = req.body as { text?: string; target_language?: string };
  if (!text || typeof text !== "string") {
    return applyHeaders(res, headers).status(400).json({ error: "text is required" });
  }
  if (text.length > 50_000) {
    return applyHeaders(res, headers).status(413).json({ error: "text exceeds maximum length of 50,000 characters" });
  }
  const target = target_language ?? "en";
  const targetName = LANGUAGE_NAMES[target] ?? target;

  const prompt = `Translate the following text into ${targetName}. Preserve meaning, tone, and any professional/legal terminology. Do NOT add commentary â€” respond ONLY with JSON in this format:
{"translated": "...", "detected_source": "ISO-639-1 code or null"}

<text_to_translate>
${text}
</text_to_translate>`;

  const systemInstruction = "You are a professional translation assistant. Translate text accurately, preserving meaning, tone, and professional/legal terminology. Respond ONLY with the requested JSON â€” no markdown, no commentary.";

  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 2048,
        system: [{ type: "text", text: systemInstruction, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      return applyHeaders(res, headers).status(502).json({ error: "Translation failed", detail: err });
    }

    const data = await r.json() as { content?: Array<{ text?: string }> };
    const content = data.content?.[0]?.text ?? "";
    let parsed: { translated?: string; detected_source?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      // Model didn't return JSON â€” return raw content as translated
      parsed = { translated: content };
    }

    return applyHeaders(res, headers).status(200).json({
      translated: parsed.translated ?? text,
      detected_source: parsed.detected_source ?? null,
      target_language: target,
    });
  } catch (e) {
    return applyHeaders(res, headers).status(502).json({ error: "Translation request failed" });
  }
}
