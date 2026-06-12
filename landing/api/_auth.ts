/** Shared Google ID token verifier (no external library needed — we verify via Google's tokeninfo endpoint) */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface VoxlenUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
  isAdmin: boolean;
}

const ADMIN_EMAIL = "ccantynz@gmail.com";
const GOOGLE_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";
const VOXLEN_ISSUER = "voxlen.ai";

function b64url(data: Buffer | string): string {
  return Buffer.from(data).toString("base64url");
}

/**
 * Mint a long-lived Voxlen desktop token (HS256 JWT). Stateless: any API
 * instance with VOXLEN_TOKEN_SECRET can verify it without a database.
 * Throws if the secret is not configured.
 */
export function mintDesktopToken(user: VoxlenUser, ttlDays = 180): { token: string; expiresAt: number } {
  const secret = process.env.VOXLEN_TOKEN_SECRET;
  if (!secret) throw new Error("VOXLEN_TOKEN_SECRET not configured");
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlDays * 86400;
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: VOXLEN_ISSUER,
    sub: user.sub,
    email: user.email,
    name: user.name,
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
  let payload: { iss?: string; sub?: string; email?: string; name?: string; exp?: number };
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
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Invalid token signature");
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired — sign in at voxlen.ai/dashboard and copy a fresh key");
  }
  return {
    sub: payload.sub ?? "",
    email: payload.email ?? "",
    name: payload.name ?? "",
    picture: "",
    isAdmin: payload.email === ADMIN_EMAIL,
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
