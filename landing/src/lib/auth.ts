export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  sub: string;
}

const KEY = "voxlen_user";
const TOKEN_KEY = "voxlen_access_token";

export function getStoredUser(): GoogleUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GoogleUser) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: GoogleUser): void {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Decode the payload from a Google ID token (JWT) without verification.
 *  Verification happens server-side; here we just need display info. */
export function parseIdToken(token: string): GoogleUser | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return {
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      sub: decoded.sub,
    };
  } catch {
    return null;
  }
}
