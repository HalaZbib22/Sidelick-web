import jwt from "jsonwebtoken";

/**
 * JWT signing/verification — hardened:
 *  - In production the app REFUSES to boot without a strong JWT_SECRET
 *    (silently falling back to a committed default = every token forgeable).
 *  - Algorithm pinned to HS256 on sign AND verify (blocks alg-swap attacks).
 *  - `iat` is enforced by the auth middleware against password_changed_at,
 *    so a password reset kills all previously issued tokens.
 */

const FALLBACK_DEV_SECRET = "dev-insecure-secret";
const SECRET = process.env.JWT_SECRET ?? FALLBACK_DEV_SECRET;

if (process.env.NODE_ENV === "production" && (SECRET === FALLBACK_DEV_SECRET || SECRET.length < 32)) {
  throw new Error(
    "FATAL: JWT_SECRET is missing or too weak for production. Set a random secret of at least 32 characters."
  );
}

const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

export interface JwtPayload {
  userId: string;
  role: "user" | "walker" | "admin";
  /** Issued-at (seconds), set automatically by jsonwebtoken. */
  iat?: number;
}

export function signToken(payload: Pick<JwtPayload, "userId" | "role">): string {
  return jwt.sign(payload, SECRET, {
    expiresIn: EXPIRES_IN,
    algorithm: "HS256",
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET, { algorithms: ["HS256"] }) as JwtPayload;
}
