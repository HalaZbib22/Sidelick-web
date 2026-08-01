/**
 * Session helpers. The auth token now lives in an httpOnly cookie set by the
 * backend — JavaScript can never read it, so XSS can't steal sessions.
 *
 * What we keep client-side is a NON-SENSITIVE display hint ({ userId, role })
 * so the UI can render the right chrome instantly on load. It grants nothing:
 * the backend validates the cookie on every request, and AuthContext
 * re-validates the hint against /api/me on mount.
 */
const HINT_KEY = "sidelick_session";

export interface Session {
  userId: string;
  role: "user" | "walker" | "admin";
}

export function getStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(HINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.userId || !parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeSession(session: Session): void {
  window.localStorage.setItem(HINT_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  window.localStorage.removeItem(HINT_KEY);
}

/** The localStorage key, exported for the cross-tab storage listener. */
export const SESSION_HINT_KEY = HINT_KEY;
