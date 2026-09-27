import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local storage adapter (dev). In production swap for S3-compatible
 * object storage implementing the same `saveUpload` contract.
 * Security: whitelist of extensions/MIME types, size limit, generated
 * filenames (no user-controlled paths — traversal impossible).
 */

export const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_UPLOADS = {
  image: {
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
  video: {
    extensions: [".mp4", ".webm", ".mov"],
    mimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
  },
} as const;

export type UploadKind = keyof typeof ALLOWED_UPLOADS;

export function validateUpload(opts: {
  fileName: string;
  mimeType: string;
  size: number;
  kind: UploadKind;
}): { ok: true; extension: string } | { ok: false; error: string } {
  const { fileName, mimeType, size, kind } = opts;
  const allowed = ALLOWED_UPLOADS[kind];

  if (size <= 0) return { ok: false, error: "Fichier vide." };
  if (size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Fichier trop volumineux (25 Mo maximum)." };
  }
  const ext = path.extname(fileName).toLowerCase();
  const allowedExtensions: readonly string[] = allowed.extensions;
  const allowedMimeTypes: readonly string[] = allowed.mimeTypes;
  if (!allowedExtensions.includes(ext)) {
    return { ok: false, error: `Extension non autorisée (${allowedExtensions.join(", ")}).` };
  }
  if (!allowedMimeTypes.includes(mimeType)) {
    return { ok: false, error: `Type MIME non autorisé (${allowedMimeTypes.join(", ")}).` };
  }
  return { ok: true, extension: ext };
}

/** Saves a validated upload under public/uploads/<subdir>/ with a random name. */
export async function saveUpload(
  file: File,
  opts: { subdir: string; kind: UploadKind },
): Promise<{ url: string; fileName: string }> {
  const check = validateUpload({
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    kind: opts.kind,
  });
  if (!check.ok) throw new Error(check.error);

  const subdir = opts.subdir.replace(/[^a-zA-Z0-9_-]/g, "");
  const fileName = `${Date.now()}_${randomBytes(8).toString("hex")}${check.extension}`;
  const dir = path.join(UPLOAD_ROOT, subdir);
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, fileName), buffer);

  return { url: `/uploads/${subdir}/${fileName}`, fileName };
}
