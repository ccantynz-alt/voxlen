import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAccessToken, extractBearer, corsHeaders } from "./_auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  if (req.method === "OPTIONS") {
    return res.status(204).set(headers).end();
  }

  const token = extractBearer(req.headers.authorization);
  if (!token) {
    return res.status(401).set(headers).json({ error: "Missing Authorization header" });
  }

  try {
    const user = await verifyAccessToken(token);
    const plan = user.plan ?? (user.isAdmin ? "admin" : "free");
    const isPaid = user.isAdmin || plan === "admin" || plan === "pro" || plan === "professional" || plan === "free_trial";
    return res.status(200).set(headers).json({
      sub: user.sub,
      email: user.email,
      name: user.name,
      picture: user.picture,
      isAdmin: user.isAdmin,
      plan,
      features: isPaid
        ? ["stt", "grammar", "export", "clauses", "billing"]
        : ["stt"],
    });
  } catch {
    return res.status(401).set(headers).json({ error: "Invalid token" });
  }
}
