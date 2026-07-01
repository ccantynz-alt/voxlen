/** Shared Google ID token verifier (no external library needed — we verify via Google's tokeninfo endpoint) */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface VoxlenUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
  isAdmin: boolean;
  plan?: string;
}

const ADMIN_EMAIL = "ccantynz@gmail.com";
const GOOGLE_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";
const VOXLEN_ISSUER = "voxlen.ai";

function b64url(data: string): string {
  return Buffer.from(data, "utf8").toString("base64url");
}

export type VoxlenPlan = "admin" | "pro" | "professional" | "free_trial" | "free";

/**
 * Mint a Voxlen desktop token (HS256 JWT). Stateless — no database needed.
 * Supports arbitrary plans and TTLs so we can issue free-trial keys with
 * a specific expiry date.
 */
export function mintDesktopToken(
  user: Pick<VoxlenUser, "sub" | "email" | "name">,
  opts: { ttlDays?: number; expiresAt?: number; plan?: VoxlenPlan } = {},
): { token: string; expiresAt: number } {
  const secret = process.env.VOXLEN_TOKEN_SECRET;
  if (!secret) throw new Error("VOXLEN_TOKEN_SECRET not configured");
  const now = Math.floor(Date.now() / 1000);
  const exp = opts.expiresAt ?? (now + (opts.ttlDays ?? 180) * 86400);
  const plan: VoxlenPlan = opts.plan ?? (user.email === ADMIN_EMAIL ? "admin" : "free");
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: VOXLEN_ISSUER,
    sub: user.sub,
    email: user.email,
    name: user.name,
    plan,
    iat: now,
    exp,
  }));
  const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return { token: `${header}.${payload}.${sig}`, expiresAt: exp };
}

/** Verify a Voxlen-issued desktop token. Returns null if it isn't one of ours. Throws if ours but invalid/expired. */
function verifyDesktopToken(token: string): VoxlenUser | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let payload: { iss?: string; sub?: string; email?: string; name?: string; plan?: string; exp?: number };
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (payload.iss !== VOXLEN_ISSUER) return null; // not ours — let Google handle it

  const secret = process.env.VOXLEN_TOKEN_SECRET;
  if (!secret) throw new Error("Voxlen token received but VOXLEN_TOKEN_SECRET not configured");
  const expected = createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
  const actual = Buffer.from(parts[2], "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(new Uint8Array(expected), new Uint8Array(actual))) {
    throw new Error("Invalid token signature");
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired — sign in at voxlen.ai/dashboard and copy a fresh key");
  }
  const VALID_PLANS: VoxlenPlan[] = ["admin", "pro", "professional", "free_trial", "free"];
  const plan = VALID_PLANS.includes(payload.plan as VoxlenPlan) ? (payload.plan as VoxlenPlan) : "free";
  return {
    sub: payload.sub ?? "",
    email: payload.email ?? "",
    name: payload.name ?? "",
    picture: "",
    plan,
    isAdmin: payload.email === ADMIN_EMAIL || plan === "admin",
  };
}

/**
 * Verify a bearer token and return the user. Accepts either a long-lived
 * Voxlen desktop token or a Google access token. Throws on failure.
 */
export async function verifyAccessToken(accessToken: string): Promise<VoxlenUser> {
  const voxlenUser = verifyDesktopToken(accessToken);
  if (voxlenUser) return voxlenUser;

  const res = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Invalid access token");
  const data = await res.json() as { sub: string; email: string; name: string; picture: string };
  return {
    sub: data.sub,
    email: data.email,
    name: data.name,
    picture: data.picture,
    isAdmin: data.email === ADMIN_EMAIL,
  };
}

/** Verify a Google ID token (JWT) using Google's tokeninfo endpoint. */
export async function verifyIdToken(idToken: string): Promise<VoxlenUser> {
  const res = await fetch(`${GOOGLE_TOKENINFO}?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error("Invalid ID token");
  const data = await res.json() as { sub: string; email: string; name: string; picture: string; aud: string };
  return {
    sub: data.sub,
    email: data.email,
    name: data.name,
    picture: data.picture,
    isAdmin: data.email === ADMIN_EMAIL,
  };
}

/** Extract Bearer token from Authorization header. Returns null if missing. */
export function extractBearer(authHeader: string | null | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

/**
 * VercelResponse is `ServerResponse & {send, json, status, redirect}` — unlike
 * Express, it has no `.set()`. Every handler chaining `res.status(n).set(headers)`
 * was throwing "res.status(...).set is not a function" on every single request
 * (crashing every endpoint in production, since corsHeaders() is applied on every
 * response path). Use this in its place: `applyHeaders(res, headers).status(n)`.
 */
export function applyHeaders<T extends { setHeader: (name: string, value: string) => void }>(
  res: T,
  headers: Record<string, string>
): T {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  return res;
}
