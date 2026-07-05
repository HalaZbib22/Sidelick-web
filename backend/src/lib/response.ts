import type { Response } from "express";

/**
 * Standard API envelope (see frontend_guide_v2.md §8).
 * Every endpoint responds through `ok` or `fail` so the shape is uniform.
 */
export interface SuccessEnvelope<T> {
  succeeded: true;
  statusCode: number;
  data: T;
  message: string | null;
  elapsedMilliseconds: number;
}

export interface ErrorEnvelope {
  succeeded: false;
  statusCode: number;
  data: null;
  message: string;
  elapsedMilliseconds: number;
  errors?: unknown;
}

function elapsed(res: Response): number {
  const start = res.locals.startTime as number | undefined;
  return start ? Date.now() - start : 0;
}

export function ok<T>(
  res: Response,
  data: T,
  message: string | null = null,
  statusCode = 200
): Response {
  const body: SuccessEnvelope<T> = {
    succeeded: true,
    statusCode,
    data,
    message,
    elapsedMilliseconds: elapsed(res),
  };
  return res.status(statusCode).json(body);
}

export function fail(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: unknown
): Response {
  const body: ErrorEnvelope = {
    succeeded: false,
    statusCode,
    data: null,
    message,
    elapsedMilliseconds: elapsed(res),
    ...(errors !== undefined ? { errors } : {}),
  };
  return res.status(statusCode).json(body);
}

/* ---- Named status helpers (use these so codes stay consistent) ---- */

/** 401 — not authenticated (no/invalid token). */
export const unauthorized = (res: Response, message = "Authentication required") =>
  fail(res, message, 401);

/** 403 — authenticated but not allowed (wrong role / not permitted). */
export const forbidden = (res: Response, message = "You don't have access to this resource") =>
  fail(res, message, 403);

/** 404 — resource missing (also used to avoid leaking others' resources). */
export const notFoundError = (res: Response, message = "Not found") =>
  fail(res, message, 404);

/** 409 — conflict (e.g. duplicate email, double booking). */
export const conflict = (res: Response, message: string) => fail(res, message, 409);

/** 422 — well-formed but invalid (validation). Pass field errors as `errors`. */
export const unprocessable = (res: Response, message: string, errors?: unknown) =>
  fail(res, message, 422, errors);
