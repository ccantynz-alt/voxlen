/** Shared Google ID token verifier (no external library needed — we verify via Google's tokeninfo endpoint) */

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

/** Verify a Google access token and return the user. Throws on failure. */
export async function verifyAccessToken(accessToken: string): Promise<VoxlenUser> {
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
