import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const BRANDING_UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "branding");

export const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_FAVICON_BYTES = 512 * 1024; // 512 KB

export const ALLOWED_LOGO_MIME_TYPES = [
  "image/png",
  "image/webp",
  "image/jpeg",
  "image/jpg",
] as const;

export const ALLOWED_LOGO_EXTENSIONS = [".png", ".webp", ".jpg", ".jpeg"] as const;

/**
 * Validates magic byte signatures from the file buffer to prevent MIME spoofing.
 */
export function verifyImageMagicBytes(buffer: Buffer): { ok: true; format: "png" | "jpeg" | "webp" } | { ok: false; error: string } {
  if (buffer.length < 12) {
    return { ok: false, error: "Fichier trop petit ou invalide." };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ok: true, format: "png" };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ok: true, format: "jpeg" };
  }

  // WebP: RIFF ... WEBP (52 49 46 46 .... 57 45 42 50)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { ok: true, format: "webp" };
  }

  return { ok: false, error: "Contenu du fichier invalide (seuls PNG, WebP et JPEG sont acceptés)." };
}

export function validateLogoUpload(opts: {
  fileName: string;
  size: number;
  mimeType: string;
  isFavicon?: boolean;
}): { ok: true; extension: string } | { ok: false; error: string } {
  const { fileName, size, mimeType, isFavicon } = opts;
  const maxBytes = isFavicon ? MAX_FAVICON_BYTES : MAX_LOGO_BYTES;

  if (size <= 0) {
    return { ok: false, error: "Fichier vide." };
  }

  if (size > maxBytes) {
    return {
      ok: false,
      error: `Fichier trop volumineux (${isFavicon ? "512 Ko" : "2 Mo"} maximum).`,
    };
  }

  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_LOGO_EXTENSIONS.includes(ext as (typeof ALLOWED_LOGO_EXTENSIONS)[number])) {
    return {
      ok: false,
      error: `Format d'extension non autorisé (${ALLOWED_LOGO_EXTENSIONS.join(", ")}). Les SVG bruts sont désactivés pour des raisons de sécurité.`,
    };
  }

  if (!ALLOWED_LOGO_MIME_TYPES.includes(mimeType as (typeof ALLOWED_LOGO_MIME_TYPES)[number])) {
    return {
      ok: false,
      error: `Type MIME non autorisé (${mimeType}).`,
    };
  }

  return { ok: true, extension: ext };
}

/**
 * Saves an uploaded logo or favicon to public/uploads/branding/<subdir>/ with cryptographic randomized filename.
 */
export async function saveLogoUpload(
  file: File,
  opts: { subdir: "platform" | "partners" | "delivery"; isFavicon?: boolean },
): Promise<{ url: string; fileName: string }> {
  const check = validateLogoUpload({
    fileName: file.name,
    size: file.size,
    mimeType: file.type,
    isFavicon: opts.isFavicon,
  });

  if (!check.ok) {
    throw new Error(check.error);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Security: verify genuine magic bytes against binary headers
  const magicCheck = verifyImageMagicBytes(buffer);
  if (!magicCheck.ok) {
    throw new Error(magicCheck.error);
  }

  const normalizedExt = magicCheck.format === "jpeg" ? ".jpg" : `.${magicCheck.format}`;
  const fileName = `${Date.now()}_${randomBytes(8).toString("hex")}${normalizedExt}`;
  const targetDir = path.join(BRANDING_UPLOAD_ROOT, opts.subdir);

  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, fileName), buffer);

  return {
    url: `/uploads/branding/${opts.subdir}/${fileName}`,
    fileName,
  };
}

/**
 * Deletes an obsolete logo file from storage to avoid orphaned assets.
 */
export async function deleteLogoUpload(fileUrl?: string | null): Promise<void> {
  if (!fileUrl || !fileUrl.startsWith("/uploads/branding/")) {
    return;
  }

  try {
    const relative = fileUrl.replace(/^\/uploads\/branding\//, "");
    // Path traversal defense
    const safePath = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
    const absolutePath = path.join(BRANDING_UPLOAD_ROOT, safePath);

    if (absolutePath.startsWith(BRANDING_UPLOAD_ROOT)) {
      await unlink(absolutePath);
    }
  } catch {
    // Silent fail if file already absent or inaccessible
  }
}
