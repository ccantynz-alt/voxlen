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

  const { text, context, writingStyle, preserveTone } = req.body as {
    text: string;
    context?: string;
    writingStyle?: string;
    preserveTone?: boolean;
  };

  if (!text || typeof text !== "string") {
    return res.status(400).set(headers).json({ error: "text is required" });
  }

  const systemPrompt = buildSystemPrompt(context, writingStyle, preserveTone);

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: text }],
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      return res.status(502).set(headers).json({ error: "Upstream error", detail: err });
    }

    const data = await upstream.json() as { content: Array<{ text: string }> };
    const corrected = data.content?.[0]?.text ?? text;
    return res.status(200).set(headers).json({ corrected });
  } catch (e) {
    return res.status(502).set(headers).json({ error: "Grammar request failed" });
  }
}

function buildSystemPrompt(
  context?: string,
  writingStyle?: string,
  preserveTone?: boolean
): string {
  const style = writingStyle ?? "professional";
  const contextNote = context && context !== "general"
    ? `The text is for a ${context.replace(/_/g, " ")} context.`
    : "";

  return [
    "You are a grammar correction assistant for legal and accounting professionals.",
    "Correct grammar, punctuation, and spelling in the user's dictated text.",
    "Return ONLY the corrected text — no explanation, no commentary, no quotes.",
    contextNote,
    `Writing style: ${style}.`,
    preserveTone
      ? "Preserve the author's voice and tone exactly — only fix errors, do not rephrase."
      : "Improve clarity where appropriate while staying faithful to the meaning.",
    "Do not add or remove substantive content.",
  ].filter(Boolean).join(" ");
}
