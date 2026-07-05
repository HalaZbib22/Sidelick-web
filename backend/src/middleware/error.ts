import type { NextFunction, Request, Response } from "express";
import { fail } from "../lib/response.js";

/** Records request start time for elapsedMilliseconds. Mount first. */
export function timing(req: Request, res: Response, next: NextFunction) {
  res.locals.startTime = Date.now();
  next();
}

/** 404 for unmatched routes. */
export function notFound(req: Request, res: Response) {
  return fail(res, `Not found: ${req.method} ${req.path}`, 404);
}

/** Catch-all error handler. Logs detail server-side, returns a safe message. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  console.error("[error]", err);
  const message =
    process.env.NODE_ENV === "production"
      ? "Something went wrong. Please try again."
      : err instanceof Error
        ? err.message
        : "Unknown error";
  return fail(res, message, 500);
}
