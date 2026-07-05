/**
 * Token + session helpers. Components should use `useAuth()` rather than
 * calling these directly (see contexts/AuthContext.tsx).
 *
 * NOTE: token is stored in localStorage for now — flagged in architecture.md
 * as XSS-exposed; revisit httpOnly cookies before handling payments.
 */
const TOKEN_KEY = "sidelick_token";

export interface Session {
  token: string;
  userId: string;
  role: "user" | "walker" | "admin";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

/** Decode the JWT payload (no verification — display only). */
export function getSession(): Session | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as {
      userId: string;
      role: Session["role"];
      exp?: number;
    };
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearToken();
      return null;
    }
    return { token, userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}
