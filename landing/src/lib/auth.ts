export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  sub: string;
}

const KEY = "voxlen_user";

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
