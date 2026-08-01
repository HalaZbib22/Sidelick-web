import type { Request, Response } from "express";

/**
 * Session cookie helpers — hand-rolled (no cookie-parser dependency; every
 * package is supply-chain surface). The JWT lives in an httpOnly cookie so
 * XSS can't read it. SameSite=Lax + the origin-check middleware covers CSRF.
 */

export const SESSION_COOKIE = "sidelick_session";

const isProd = () => process.env.NODE_ENV === "production";

/** Parse the Cookie header into a name → value map. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      /* skip malformed values */
    }
  }
  return out;
}

/** Read the session token from the request's cookies. */
export function sessionTokenFrom(req: Request): string | undefined {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE];
}

/**
 * Set the session cookie. `remember` = persistent (7 days); otherwise a
 * session cookie that dies with the browser.
 */
export function setSessionCookie(res: Response, token: string, remember: boolean): void {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (remember) parts.push(`Max-Age=${7 * 24 * 60 * 60}`);
  if (isProd()) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

/** Clear the session cookie (logout / auth failure). */
export function clearSessionCookie(res: Response): void {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isProd()) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}
