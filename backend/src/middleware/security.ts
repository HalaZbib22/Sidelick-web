import type { NextFunction, Request, Response } from "express";
import { fail } from "../lib/response.js";

/**
 * Hand-rolled security middleware — zero dependencies on purpose (every npm
 * package is supply-chain attack surface; these are a few dozen lines each).
 *
 *  - securityHeaders: hardened response headers for an API.
 *  - rateLimit: fixed-window in-memory limiter (per IP + route group).
 *  - originCheck: CSRF defense-in-depth — mutating requests must come from
 *    an allowed Origin (pairs with SameSite=Lax cookies).
 */

const isProd = () => process.env.NODE_ENV === "production";

export function allowedOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/** Hardened headers for every API response. */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // The API serves JSON + images only — no scripts should ever execute here.
  res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; frame-ancestors 'none'");
  if (isProd()) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window in-memory rate limiter. Suits a single-instance deployment;
 * swap for a Redis-backed limiter when the API scales horizontally.
 */
export function rateLimit(options: { windowMs: number; max: number; name: string }) {
  const buckets = new Map<string, Bucket>();

  // Prune expired buckets so memory stays bounded.
  setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
  }, options.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${options.name}:${req.ip}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > options.max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return fail(res, "Too many requests — slow down and try again shortly.", 429);
    }
    next();
  };
}

/**
 * CSRF defense-in-depth: browsers always send Origin on cross-origin
 * mutations. If Origin is present and NOT ours, reject. (Same-origin
 * requests may omit Origin; non-browser clients use Bearer auth and are
 * unaffected by cookie-based CSRF.)
 */
export function originCheck(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  const origin = req.headers.origin;
  if (origin && !allowedOrigins().includes(origin)) {
    return fail(res, "Cross-origin request rejected.", 403);
  }
  next();
}
