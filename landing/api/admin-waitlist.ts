import type { VercelRequest, VercelResponse } from "@vercel/node";
import { corsHeaders, extractBearer, verifyAccessToken, applyHeaders } from "./_auth";

const ADMIN_EMAIL = "ccantynz@gmail.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  if (req.method === "OPTIONS") {
    return applyHeaders(res, headers).status(204).end();
  }
  if (req.method !== "GET") {
    return applyHeaders(res, headers).status(405).json({ error: "Method not allowed" });
  }

  const token = extractBearer(req.headers.authorization);
  if (!token) {
    return applyHeaders(res, headers).status(401).json({ error: "Unauthorized" });
  }

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    return applyHeaders(res, headers).status(401).json({ error: "Invalid token" });
  }

  if (user.email !== ADMIN_EMAIL) {
    return applyHeaders(res, headers).status(403).json({ error: "Forbidden" });
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return applyHeaders(res, headers).status(200).json({ entries: [], total: 0, source: "kv_not_configured" });
  }

  try {
    // LRANGE voxlen:waitlist 0 -1 — get all entries
    const r = await fetch(`${kvUrl}/lrange/voxlen:waitlist/0/-1`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    });
    if (!r.ok) {
      const text = await r.text();
      return applyHeaders(res, headers).status(502).json({ error: "KV error", detail: text });
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

    return applyHeaders(res, headers).status(200).json({ entries, total: entries.length });
  } catch (e) {
    return applyHeaders(res, headers).status(500).json({ error: "Internal error", detail: String(e) });
  }
}
