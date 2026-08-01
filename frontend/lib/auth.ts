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
  // Persistent ("remember me") tokens live in localStorage; session-only
  // tokens live in sessionStorage and vanish when the browser closes.
  return (
    window.localStorage.getItem(TOKEN_KEY) ??
    window.sessionStorage.getItem(TOKEN_KEY)
  );
}

/**
 * Store the auth token. `remember = true` (default) persists across browser
 * restarts via localStorage; `false` keeps it session-only via sessionStorage.
 * Either way we clear the other store so a single source of truth remains.
 */
export function setToken(token: string, remember = true): void {
  if (remember) {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.sessionStorage.removeItem(TOKEN_KEY);
  } else {
    window.sessionStorage.setItem(TOKEN_KEY, token);
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(TOKEN_KEY);
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
