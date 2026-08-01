import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { ok, unprocessable } from "../lib/response.js";
import { ALLOWED_IMAGE_TYPES, safeImageFilename, verifyImageMagicBytes } from "../lib/uploads.js";

/**
 * Public image uploads (pet photos, future profile photos).
 * Files land in public_uploads/ and are served statically at /uploads/<name>
 * with nosniff + a sandboxing CSP (see index.ts), so even a smuggled non-image
 * can never execute. Hardening:
 *  - extension derived from OUR mimetype map, never the client filename
 *  - CSPRNG filenames (crypto.randomUUID)
 *  - magic-byte validation after write (Content-Type is client-controlled)
 *  - URL built from PUBLIC_API_URL, not the spoofable Host header
 * Mounted behind requireAuth — anonymous users can't upload.
 */
export const uploadsRouter = Router();

export const publicUploadDir = path.resolve("public_uploads");
fs.mkdirSync(publicUploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, publicUploadDir),
    filename: (_req, file, cb) => cb(null, safeImageFilename(file.mimetype)),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5, parts: 8 }, // 5MB
  fileFilter: (_req, file, cb) =>
    cb(null, (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)),
});

// POST /api/upload/image — field name "image"; returns the public URL.
uploadsRouter.post("/image", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return unprocessable(res, "Attach a JPG, PNG, or WebP image up to 5MB.");
  }
  if (!(await verifyImageMagicBytes(req.file.path, req.file.mimetype))) {
    return unprocessable(res, "That file isn't a valid image.");
  }
  const base =
    process.env.PUBLIC_API_URL ?? `${req.protocol}://${req.get("host")}`;
  const url = `${base.replace(/\/$/, "")}/uploads/${req.file.filename}`;
  return ok(res, { url }, "Image uploaded", 201);
});
