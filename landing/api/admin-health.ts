import type { VercelRequest, VercelResponse } from "@vercel/node";
import { corsHeaders, extractBearer, verifyAccessToken, applyHeaders } from "./_auth.js";

const ADMIN_EMAIL = "ccantynz@gmail.com";

/** Env vars we check are set (we never return their values) */
const ENV_VARS_TO_CHECK = [
  "DEEPGRAM_API_KEY",
  "ANTHROPIC_API_KEY",
  "VOXLEN_TOKEN_SECRET",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "RESEND_API_KEY",
] as const;

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

  const envStatus: Record<string, boolean> = {};
  for (const key of ENV_VARS_TO_CHECK) {
    envStatus[key] = Boolean(process.env[key]);
  }

  return applyHeaders(res, headers).status(200).json({
    ok: true,
    env: envStatus,
    timestamp: new Date().toISOString(),
  });
}
