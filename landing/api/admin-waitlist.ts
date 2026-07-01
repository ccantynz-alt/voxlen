import type { VercelRequest, VercelResponse } from "@vercel/node";
import { corsHeaders, extractBearer, verifyAccessToken } from "./_auth";

const ADMIN_EMAIL = "ccantynz@gmail.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  if (req.method === "OPTIONS") {
    return res.status(204).set(headers).end();
  }
  if (req.method !== "GET") {
    return res.status(405).set(headers).json({ error: "Method not allowed" });
  }

  const token = extractBearer(req.headers.authorization);
  if (!token) {
    return res.status(401).set(headers).json({ error: "Unauthorized" });
  }

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    return res.status(401).set(headers).json({ error: "Invalid token" });
  }

  if (user.email !== ADMIN_EMAIL) {
    return res.status(403).set(headers).json({ error: "Forbidden" });
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return res.status(200).set(headers).json({ entries: [], total: 0, source: "kv_not_configured" });
  }

  try {
    // LRANGE voxlen:waitlist 0 -1 — get all entries
    const r = await fetch(`${kvUrl}/lrange/voxlen:waitlist/0/-1`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(502).set(headers).json({ error: "KV error", detail: text });
    }
    const json = await r.json() as { result?: string[] };
    const raw: string[] = json.result ?? [];

    const entries = raw.map((item) => {
      try {
        return JSON.parse(decodeURIComponent(item)) as {
          email: string;
          platform: string;
          date: string;
          ip?: string | null;
        };
      } catch {
        return { email: item, platform: "unknown", date: "", ip: null };
      }
    });

    return res.status(200).set(headers).json({ entries, total: entries.length });
  } catch (e) {
    return res.status(500).set(headers).json({ error: "Internal error", detail: String(e) });
  }
}
