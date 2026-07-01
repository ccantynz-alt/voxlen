import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAccessToken, extractBearer, corsHeaders } from "./_auth";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY!;
const DEEPGRAM_KEYS_URL = "https://api.deepgram.com/v1/projects";

/** Issues a short-lived Deepgram temporary key for the verified user.
 *  The desktop app uses this key to open a WebSocket directly to Deepgram.
 *  TTL: 30 seconds — enough to open the connection, not enough to be abused. */
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

  try {
    // First get the project ID
    const projectsRes = await fetch(DEEPGRAM_KEYS_URL, {
      headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
    });
    if (!projectsRes.ok) throw new Error("Failed to fetch Deepgram projects");
    const { projects } = await projectsRes.json() as { projects: Array<{ project_id: string }> };
    const projectId = projects[0]?.project_id;
    if (!projectId) throw new Error("No Deepgram project found");

    // Create a temporary key with 30-second TTL
    const keyRes = await fetch(`${DEEPGRAM_KEYS_URL}/${projectId}/keys`, {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: "voxlen-temp",
        scopes: ["usage:write"],
        time_to_live_in_seconds: 30,
      }),
    });

    if (!keyRes.ok) {
      const err = await keyRes.text();
      console.error("Deepgram temp key error:", err);
      return res.status(503).set(headers).json({ error: "STT token generation failed" });
    }

    const dgJson = await keyRes.json() as { key?: { api_key?: string } };
    const apiKey = dgJson?.key?.api_key;
    if (!apiKey) {
      return res.status(503).set(headers).json({ error: "STT token generation failed" });
    }
    return res.status(200).set(headers).json({
      key: apiKey,
      ttl: 30,
      fallback: false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "STT token unavailable";
    return res.status(503).set(headers).json({ error: msg });
  }
}
