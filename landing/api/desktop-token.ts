import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAccessToken, extractBearer, corsHeaders, mintDesktopToken } from "./_auth";

/**
 * Exchange a (short-lived) Google access token for a long-lived Voxlen
 * desktop token, so the desktop app keeps working long after the browser
 * session's Google token expires.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  if (req.method === "OPTIONS") {
    return res.status(204).set(headers).end();
  }
  if (req.method !== "POST") {
    return res.status(405).set(headers).json({ error: "Method not allowed" });
  }

  const bearer = extractBearer(req.headers.authorization);
  if (!bearer) {
    return res.status(401).set(headers).json({ error: "Missing Authorization header" });
  }

  let user;
  try {
    user = await verifyAccessToken(bearer);
  } catch {
    return res.status(401).set(headers).json({ error: "Invalid token" });
  }

  try {
    const { token, expiresAt } = mintDesktopToken(user);
    return res.status(200).set(headers).json({ token, expires_at: expiresAt });
  } catch {
    // VOXLEN_TOKEN_SECRET not configured — caller should fall back to the session token
    return res.status(503).set(headers).json({ error: "Desktop tokens not configured" });
  }
}
