import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, validateUpload } from "@/lib/storage";

describe("validateUpload — secure file uploads", () => {
  it("accepts a valid image", () => {
    const r = validateUpload({
      fileName: "photo.JPG",
      mimeType: "image/jpeg",
      size: 1024,
      kind: "image",
    });
    expect(r.ok).toBe(true);
  });

  it("rejects executable extensions", () => {
    const r = validateUpload({
      fileName: "evil.exe",
      mimeType: "image/jpeg",
      size: 1024,
      kind: "image",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects MIME/extension mismatch", () => {
    const r = validateUpload({
      fileName: "photo.png",
      mimeType: "application/x-msdownload",
      size: 1024,
      kind: "image",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects oversized files", () => {
    const r = validateUpload({
      fileName: "video.mp4",
      mimeType: "video/mp4",
      size: MAX_UPLOAD_BYTES + 1,
      kind: "video",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects empty files", () => {
    const r = validateUpload({
      fileName: "photo.png",
      mimeType: "image/png",
      size: 0,
      kind: "image",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects images in the video kind", () => {
    const r = validateUpload({
      fileName: "photo.png",
      mimeType: "image/png",
      size: 1000,
      kind: "video",
    });
    expect(r.ok).toBe(false);
  });
});
