import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAccessToken, extractBearer, lookupPlan, corsHeaders, applyHeaders } from "./_auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  if (req.method === "OPTIONS") {
    return applyHeaders(res, headers).status(204).end();
  }

  const token = extractBearer(req.headers.authorization);
  if (!token) {
    return applyHeaders(res, headers).status(401).json({ error: "Missing Authorization header" });
  }

  try {
    const user = await verifyAccessToken(token);
    const plan = user.isAdmin ? "admin" : (await lookupPlan(user.email) ?? user.plan ?? "free");
    const isPaid = user.isAdmin || plan === "admin" || plan === "pro" || plan === "professional" || plan === "privileged" || plan === "firm" || plan === "free_trial";
    return applyHeaders(res, headers).status(200).json({
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
    return applyHeaders(res, headers).status(401).json({ error: "Invalid token" });
  }
}
