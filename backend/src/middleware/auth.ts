import type { NextFunction, Request, Response } from "express";
import { verifyToken, type JwtPayload } from "../lib/jwt.js";
import { unauthorized, forbidden } from "../lib/response.js";
import { query } from "../lib/db.js";

// Augment Express Request with the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/** Require a valid Bearer token; attaches req.user. → 401 if missing/invalid. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return unauthorized(res);
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    return unauthorized(res, "Invalid or expired session");
  }
}

/** Require the authenticated user to have one of the given roles. → 403 otherwise. */
export function requireRole(...roles: JwtPayload["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return unauthorized(res);
    if (!roles.includes(req.user.role)) {
      return forbidden(res);
    }
    next();
  };
}

/**
 * Resource-ownership check for handlers.
 * Admins pass; otherwise the caller must own the resource.
 * Returns true if allowed. On a privacy-preserving denial, prefer responding
 * with 404 (notFoundError) so you don't reveal that someone else's row exists.
 */
export function isOwnerOrAdmin(req: Request, resourceOwnerId: string): boolean {
  if (!req.user) return false;
  return req.user.role === "admin" || req.user.userId === resourceOwnerId;
}

/**
 * Gate walker-only actions that require a VERIFIED walker (e.g. accepting
 * bookings, appearing in search). Pending/unverified walkers get 403.
 * Use this on booking/discovery routes as they're built.
 */
export async function requireVerifiedWalker(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return unauthorized(res);
  if (req.user.role !== "walker") return forbidden(res);
  const r = await query<{ verification_status: string }>(
    "SELECT verification_status FROM users WHERE id = $1",
    [req.user.userId]
  );
  if (r.rows[0]?.verification_status !== "verified") {
    return forbidden(res, "Your account must be verified before you can do this.");
  }
  next();
}
