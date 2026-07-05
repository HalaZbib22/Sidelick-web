import fs from "node:fs";
import path from "node:path";
import multer from "multer";

// All private uploads (verification docs + walk photos) live in one flat dir.
// Refs stored in the DB carry a namespace (private://walk/..., private://verification/...)
// for bookkeeping, but files are resolved by filename only.
export const uploadDir = path.resolve("private_uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
});

/** Single-image multipart upload (JPG/PNG/WebP, ≤10MB). */
export function imageUpload() {
  return multer({
    storage: imageStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) =>
      cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
  });
}

/** Build a stored ref from a saved file, namespaced for readability. */
export function privateRef(namespace: string, filename: string): string {
  return `private://${namespace}/${filename}`;
}

/**
 * Resolve a private:// ref to an on-disk path, guarding against traversal.
 * Returns null if the ref is empty, malformed, escapes the dir, or is missing.
 */
export function resolvePrivateFile(ref: string | null): string | null {
  if (!ref) return null;
  const filename = ref.split("/").pop();
  if (!filename) return null;
  const resolved = path.resolve(uploadDir, filename);
  if (!resolved.startsWith(uploadDir)) return null;
  return fs.existsSync(resolved) ? resolved : null;
}
