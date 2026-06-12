import type { VercelRequest, VercelResponse } from "@vercel/node";
import { corsHeaders, extractBearer, verifyAccessToken } from "./_auth";

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

  const envStatus: Record<string, boolean> = {};
  for (const key of ENV_VARS_TO_CHECK) {
    envStatus[key] = Boolean(process.env[key]);
  }

  return res.status(200).set(headers).json({
    ok: true,
    env: envStatus,
    timestamp: new Date().toISOString(),
  });
}
