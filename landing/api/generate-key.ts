import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAccessToken, extractBearer, mintDesktopToken, lookupPlan, corsHeaders, applyHeaders } from "./_auth.js";
import type { VoxlenPlan } from "./_auth.js";

const ADMIN_EMAIL = "ccantynz@gmail.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  if (req.method === "OPTIONS") return applyHeaders(res, headers).status(204).end();
  if (req.method !== "POST") return applyHeaders(res, headers).status(405).json({ error: "Method not allowed" });

  const token = extractBearer(req.headers.authorization);
  if (!token) return applyHeaders(res, headers).status(401).json({ error: "Missing Authorization header" });

  let caller;
  try {
    caller = await verifyAccessToken(token);
  } catch {
    return applyHeaders(res, headers).status(401).json({ error: "Invalid token" });
  }

  const body = req.body as {
    // Self-service: no body needed â€” generates a key for the caller.
    // Admin-only: can issue keys for other users.
    targetEmail?: string;
    targetName?: string;
    plan?: VoxlenPlan;
    ttlDays?: number;
    expiresAt?: number; // Unix timestamp â€” overrides ttlDays
  };

  // Admin can issue keys for anyone. Regular users can only issue for themselves.
  const isAdmin = caller.isAdmin || caller.email === ADMIN_EMAIL;
  if (body.targetEmail && body.targetEmail !== caller.email && !isAdmin) {
    return applyHeaders(res, headers).status(403).json({ error: "Only admins can issue keys for other users" });
  }

  const targetEmail = body.targetEmail ?? caller.email;
  const targetName = body.targetName ?? caller.name;

  // Plan: admin can specify any plan. Self-service always gets the caller's existing plan.
  let plan: VoxlenPlan;
  if (isAdmin && body.plan) {
    plan = body.plan;
  } else if (caller.isAdmin || caller.email === ADMIN_EMAIL) {
    plan = "admin";
  } else {
    // Non-admin: targetEmail === caller.email (enforced above), but look up by
    // caller.email anyway so a request-supplied email can never select the plan.
    plan = await lookupPlan(caller.email) ?? (caller.plan as VoxlenPlan) ?? "free";
  }

  // TTL: default 180 days for regular users, 365 for admin.
  // Admin can override for any issued key.
  let expiresAt: number | undefined;
  let ttlDays: number;
  if (body.expiresAt && isAdmin) {
    expiresAt = body.expiresAt;
    ttlDays = Math.ceil((body.expiresAt - Date.now() / 1000) / 86400);
  } else if (body.ttlDays && isAdmin) {
    ttlDays = body.ttlDays;
  } else {
    ttlDays = plan === "admin" ? 365 : 180;
  }

  // Use a deterministic sub for admin-issued keys targeting other users
  // (we don't have their Google sub, so derive one from their email).
  const targetSub = targetEmail === caller.email
    ? caller.sub
    : `email:${targetEmail}`;

  try {
    const { token: apiKey, expiresAt: exp } = await mintDesktopToken(
      { sub: targetSub, email: targetEmail, name: targetName },
      { ttlDays, expiresAt, plan },
    );

    return applyHeaders(res, headers).status(200).json({
      token: apiKey,
      expiresAt: exp,
      expiresDate: new Date(exp * 1000).toISOString().split("T")[0],
      plan,
      email: targetEmail,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Key generation failed";
    return applyHeaders(res, headers).status(503).json({ error: msg });
  }
}
