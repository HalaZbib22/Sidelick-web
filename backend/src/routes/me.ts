import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import { ok, notFoundError, unprocessable } from "../lib/response.js";
import { query, pool } from "../lib/db.js";
import { activeProvider } from "../lib/verification.js";

// Mounted behind requireAuth — every route here has req.user.
export const meRouter = Router();

const SELECT_ME = `
  id, role, first_name AS "firstName", last_name AS "lastName", email, phone,
  profile_photo_url AS "profilePhotoUrl", bio, locale,
  preferred_currency AS "preferredCurrency",
  service_types      AS "serviceTypes",
  subscription_tier  AS "subscriptionTier",
  max_pack_size      AS "maxPackSize",
  max_boarding_pets  AS "maxBoardingPets",
  verification_status AS "verificationStatus"
`;

// GET /api/me — current user's profile.
meRouter.get("/", async (req, res) => {
  const result = await query(`SELECT ${SELECT_ME} FROM users WHERE id = $1`, [req.user!.userId]);
  const user = result.rows[0];
  if (!user) return notFoundError(res, "User not found");
  return ok(res, { user });
});

// ---- Walker profile (services + capacity + bio) ----
const walkerProfileSchema = z.object({
  serviceTypes: z.array(z.enum(["walk", "sit"])).min(1, "Choose at least one service"),
  maxPackSize: z.coerce.number().int().min(1).max(4).optional(),
  maxBoardingPets: z.coerce.number().int().min(1).max(3).optional(),
  bio: z.string().max(500).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

meRouter.patch("/walker-profile", async (req, res) => {
  const parsed = walkerProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return unprocessable(res, "Please check the form and try again.", parsed.error.flatten());
  }
  const p = parsed.data;
  const result = await query(
    `UPDATE users
       SET service_types = $1::jsonb,
           max_pack_size = $2,
           max_boarding_pets = $3,
           bio = COALESCE($4, bio),
           latitude = COALESCE($5, latitude),
           longitude = COALESCE($6, longitude)
     WHERE id = $7
     RETURNING ${SELECT_ME}`,
    [
      JSON.stringify(p.serviceTypes),
      p.maxPackSize ?? null,
      p.maxBoardingPets ?? null,
      p.bio ?? null,
      p.latitude ?? null,
      p.longitude ?? null,
      req.user!.userId,
    ]
  );
  return ok(res, { user: result.rows[0] }, "Profile saved");
});

// ---- Availability (weekly schedule) ----
const availabilitySchema = z.object({
  slots: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
      })
    )
    .max(21),
});

meRouter.get("/availability", async (req, res) => {
  const result = await query(
    `SELECT weekday, start_time AS "startTime", end_time AS "endTime"
       FROM availability WHERE walker_id = $1 ORDER BY weekday, start_time`,
    [req.user!.userId]
  );
  return ok(res, { slots: result.rows });
});

meRouter.put("/availability", async (req, res) => {
  const parsed = availabilitySchema.safeParse(req.body);
  if (!parsed.success) {
    return unprocessable(res, "Please check your availability and try again.", parsed.error.flatten());
  }
  const uid = req.user!.userId;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM availability WHERE walker_id = $1", [uid]);
    for (const s of parsed.data.slots) {
      if (s.endTime <= s.startTime) continue; // skip invalid ranges
      await client.query(
        "INSERT INTO availability (walker_id, weekday, start_time, end_time) VALUES ($1, $2, $3, $4)",
        [uid, s.weekday, s.startTime, s.endTime]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return ok(res, { saved: true }, "Availability saved");
});

// ---- Identity verification (private upload) ----
const uploadDir = path.resolve("private_uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) =>
    cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
});

const docTypes = ["national_id", "drivers_license", "passport"] as const;

// Accepts an ID document + a live selfie (for face match).
meRouter.post(
  "/verification",
  upload.fields([
    { name: "document", maxCount: 1 },
    { name: "selfie", maxCount: 1 },
  ]),
  async (req, res) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const doc = files?.document?.[0];
    const selfie = files?.selfie?.[0];
    if (!doc) return unprocessable(res, "Please attach a clear photo of your ID (JPG, PNG, or WebP).");
    if (!selfie) return unprocessable(res, "Please add a live selfie so we can match it to your ID.");

    const docType = req.body?.docType as string;
    if (!docTypes.includes(docType as (typeof docTypes)[number])) {
      return unprocessable(res, "Please choose a valid document type.");
    }

    const docRef = `private://verification/${doc.filename}`;
    const selfieRef = `private://verification/${selfie.filename}`;
    const outcome = await activeProvider.submit({
      docRef,
      selfieRef,
      docType: docType as (typeof docTypes)[number],
    });

    await query(
      `UPDATE users
         SET verification_doc_url = $1,
             verification_selfie_url = $2,
             verification_doc_type = $3,
             verification_provider = $4,
             verification_result = $5,
             verification_submitted_at = now(),
             verification_status = $6
       WHERE id = $7`,
      [
        docRef,
        selfieRef,
        docType,
        outcome.provider,
        outcome.result ? JSON.stringify(outcome.result) : null,
        outcome.status,
        req.user!.userId,
      ]
    );
    return ok(res, { verificationStatus: outcome.status, docType }, "Submitted for review");
  }
);
