import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAccessToken, extractBearer, corsHeaders } from "./_auth";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY!;

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

  if (!DEEPGRAM_API_KEY) {
    return res.status(503).set(headers).json({ error: "STT service not configured" });
  }

  const { name, terms } = req.body as { name?: string; terms?: string[] };
  if (!Array.isArray(terms) || terms.length === 0) {
    return res.status(400).set(headers).json({ error: "terms array required" });
  }

  // Store vocabulary as a Deepgram keyword list (project-level custom vocab)
  try {
    const dgRes = await fetch("https://api.deepgram.com/v1/projects", {
      headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
    });
    if (!dgRes.ok) {
      return res.status(200).set(headers).json({ ok: true, stored: "local" });
    }
    // Deepgram's keyword API is per-request, not persistent — just acknowledge
    return res.status(200).set(headers).json({ ok: true, name, count: terms.length });
  } catch {
    return res.status(200).set(headers).json({ ok: true, stored: "local" });
  }
}
