import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ok, fail } from "../lib/response.js";
import { query } from "../lib/db.js";
import { signToken } from "../lib/jwt.js";

export const authRouter = Router();

const signupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  role: z.enum(["user", "walker"]),
});

// POST /api/auth/signup
authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, "Please check the form and try again.", 400, parsed.error.flatten());
  }
  const { firstName, lastName, email, phone, password, role } = parsed.data;

  const existing = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
  if (existing.rowCount) return fail(res, "Email already in use", 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query<{ id: string; role: "user" | "walker" }>(
    `INSERT INTO users (role, first_name, last_name, email, phone, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, role`,
    [role, firstName, lastName, email.toLowerCase(), phone ?? null, passwordHash]
  );

  const user = result.rows[0];
  const token = signToken({ userId: user.id, role: user.role });
  return ok(res, { token, user: { id: user.id, role: user.role } }, "Account created successfully", 201);
});

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/signin
authRouter.post("/signin", async (req, res) => {
  const parsed = signinSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, "Email and password are required.", 400);
  const { email, password } = parsed.data;

  const result = await query<{ id: string; role: "user" | "walker" | "admin"; password_hash: string | null }>(
    "SELECT id, role, password_hash FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  const user = result.rows[0];
  if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    return fail(res, "Invalid credentials", 401);
  }

  const token = signToken({ userId: user.id, role: user.role });
  return ok(res, { token, user: { id: user.id, role: user.role } }, "Signed in successfully");
});

const forgotSchema = z.object({ email: z.string().email() });

// POST /api/auth/forgot-password — always succeeds (no email enumeration).
authRouter.post("/forgot-password", async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, "A valid email is required.", 400, parsed.error.flatten());
  }
  const email = parsed.data.email.toLowerCase();

  const result = await query<{ id: string; password_hash: string | null }>(
    "SELECT id, password_hash FROM users WHERE email = $1",
    [email]
  );
  const user = result.rows[0];

  let resetUrl: string | undefined;
  // Only issue a token for real, password-based accounts.
  if (user && user.password_hash) {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await query(
      "UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3",
      [token, expires, user.id]
    );
    const frontend = process.env.FRONTEND_URL ?? "http://localhost:3000";
    const url = `${frontend}/reset-password?token=${token}`;
    if (process.env.NODE_ENV !== "production") resetUrl = url; // dev convenience
    // TODO: in production, email the link instead of returning it.
  }

  return ok(
    res,
    resetUrl ? { resetUrl } : {},
    "If an account exists, a reset link has been sent."
  );
});

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

// POST /api/auth/reset-password
authRouter.post("/reset-password", async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, "Please choose a password of at least 8 characters.", 400, parsed.error.flatten());
  }
  const { token, password } = parsed.data;

  const result = await query<{ id: string }>(
    "SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > now()",
    [token]
  );
  const user = result.rows[0];
  if (!user) return fail(res, "Invalid or expired reset token", 400);

  const passwordHash = await bcrypt.hash(password, 10);
  await query(
    `UPDATE users
     SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL
     WHERE id = $2`,
    [passwordHash, user.id]
  );

  return ok(res, {}, "Password has been reset successfully");
});
