import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { ok, unprocessable } from "../lib/response.js";

/**
 * Public image uploads (pet photos, future profile photos).
 * Files land in public_uploads/ and are served statically at /uploads/<name>
 * (mounted in index.ts), so the returned URL works directly in <img> tags.
 * Distinct from private_uploads/ (verification docs), which stays auth-gated.
 * Mounted behind requireAuth — anonymous users can't upload.
 */
export const uploadsRouter = Router();

export const publicUploadDir = path.resolve("public_uploads");
fs.mkdirSync(publicUploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, publicUploadDir),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — plenty for a pet photo
  fileFilter: (_req, file, cb) =>
    cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
});

// POST /api/upload/image — field name "image"; returns the public URL.
uploadsRouter.post("/image", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return unprocessable(res, "Attach a JPG, PNG, or WebP image up to 5MB.");
  }
  const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  return ok(res, { url }, "Image uploaded", 201);
});
