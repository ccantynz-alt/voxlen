import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAccessToken, extractBearer, corsHeaders, mintDesktopToken, applyHeaders } from "./_auth";

/**
 * Exchange a (short-lived) Google access token for a long-lived Voxlen
 * desktop token, so the desktop app keeps working long after the browser
 * session's Google token expires.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  if (req.method === "OPTIONS") {
    return applyHeaders(res, headers).status(204).end();
  }
  if (req.method !== "POST") {
    return applyHeaders(res, headers).status(405).json({ error: "Method not allowed" });
  }

  const bearer = extractBearer(req.headers.authorization);
  if (!bearer) {
    return applyHeaders(res, headers).status(401).json({ error: "Missing Authorization header" });
  }

  let user;
  try {
    user = await verifyAccessToken(bearer);
  } catch {
    return applyHeaders(res, headers).status(401).json({ error: "Invalid token" });
  }

  try {
    const { token, expiresAt } = mintDesktopToken(user);
    return applyHeaders(res, headers).status(200).json({ token, expires_at: expiresAt });
  } catch {
    // VOXLEN_TOKEN_SECRET not configured — caller should fall back to the session token
    return applyHeaders(res, headers).status(503).json({ error: "Desktop tokens not configured" });
  }
}
