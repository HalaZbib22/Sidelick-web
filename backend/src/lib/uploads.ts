import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";

// All private uploads (verification docs + walk photos) live in one flat dir.
// Refs stored in the DB carry a namespace (private://walk/..., private://verification/...)
// for bookkeeping, but files are resolved by filename only.
export const uploadDir = path.resolve("private_uploads");
fs.mkdirSync(uploadDir, { recursive: true });

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * The extension comes from OUR mimetype map, never from the client's filename
 * (an attacker-controlled extension + spoofed mimetype is how HTML lands on
 * disk). Filenames use a CSPRNG — unguessable, collision-free.
 */
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function safeImageFilename(mimetype: string): string {
  return `${crypto.randomUUID()}${EXT_BY_MIME[mimetype] ?? ".bin"}`;
}

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, safeImageFilename(file.mimetype)),
});

/** Single-image multipart upload (JPG/PNG/WebP, ≤10MB, one file, few fields). */
export function imageUpload() {
  return multer({
    storage: imageStorage,
    limits: { fileSize: 10 * 1024 * 1024, files: 2, fields: 10, parts: 15 },
    fileFilter: (_req, file, cb) =>
      cb(null, (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)),
  });
}

/**
 * Magic-byte validation — the client's Content-Type is just a header anyone
 * can set. After multer writes the file, verify the bytes actually ARE the
 * claimed image format; delete and reject otherwise.
 */
export async function verifyImageMagicBytes(filePath: string, mimetype: string): Promise<boolean> {
  let fh: fs.promises.FileHandle | null = null;
  try {
    fh = await fs.promises.open(filePath, "r");
    const buf = Buffer.alloc(12);
    await fh.read(buf, 0, 12, 0);
    let valid = false;
    if (mimetype === "image/jpeg") {
      valid = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    } else if (mimetype === "image/png") {
      valid = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    } else if (mimetype === "image/webp") {
      valid = buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
    }
    if (!valid) await fs.promises.unlink(filePath).catch(() => {});
    return valid;
  } catch {
    if (fh) await fs.promises.unlink(filePath).catch(() => {});
    return false;
  } finally {
    await fh?.close().catch(() => {});
  }
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
  if (!resolved.startsWith(uploadDir + path.sep)) return null;
  return fs.existsSync(resolved) ? resolved : null;
}
