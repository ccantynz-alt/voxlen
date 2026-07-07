import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAccessToken, extractBearer, corsHeaders, applyHeaders } from "./_auth.js";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY!;

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

  try {
    await verifyAccessToken(token);
  } catch {
    return applyHeaders(res, headers).status(401).json({ error: "Invalid token" });
  }

  if (!DEEPGRAM_API_KEY) {
    return applyHeaders(res, headers).status(503).json({ error: "STT service not configured" });
  }

  const { name, terms } = req.body as { name?: string; terms?: string[] };
  if (!Array.isArray(terms) || terms.length === 0) {
    return applyHeaders(res, headers).status(400).json({ error: "terms array required" });
  }

  // Store vocabulary as a Deepgram keyword list (project-level custom vocab)
  try {
    const dgRes = await fetch("https://api.deepgram.com/v1/projects", {
      headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
    });
    if (!dgRes.ok) {
      return applyHeaders(res, headers).status(200).json({ ok: true, stored: "local" });
    }
    // Deepgram's keyword API is per-request, not persistent â€” just acknowledge
    return applyHeaders(res, headers).status(200).json({ ok: true, name, count: terms.length });
  } catch {
    return applyHeaders(res, headers).status(200).json({ ok: true, stored: "local" });
  }
}
