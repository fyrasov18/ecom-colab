import { describe, it, expect } from "vitest";
import {
  extractGoogleDriveFileId,
  deriveGoogleDriveUrls,
  isValidGoogleDriveUrl,
} from "@/lib/google-drive";

describe("Google Drive link extraction and normalization", () => {
  const sampleFileId = "1a2B3c4D5e6F7g8H9i0J_kLmNoPqRsTuV";

  it("extracts ID from standard view link", () => {
    const url = `https://drive.google.com/file/d/${sampleFileId}/view?usp=sharing`;
    expect(extractGoogleDriveFileId(url)).toBe(sampleFileId);
    expect(isValidGoogleDriveUrl(url)).toBe(true);
  });

  it("extracts ID from uc?export=download link", () => {
    const url = `https://drive.google.com/uc?export=download&id=${sampleFileId}`;
    expect(extractGoogleDriveFileId(url)).toBe(sampleFileId);
    expect(isValidGoogleDriveUrl(url)).toBe(true);
  });

  it("extracts ID from open?id link", () => {
    const url = `https://drive.google.com/open?id=${sampleFileId}`;
    expect(extractGoogleDriveFileId(url)).toBe(sampleFileId);
  });

  it("extracts ID from docs.google.com/file/d/ link", () => {
    const url = `https://docs.google.com/file/d/${sampleFileId}/edit`;
    expect(extractGoogleDriveFileId(url)).toBe(sampleFileId);
  });

  it("extracts raw file ID directly", () => {
    expect(extractGoogleDriveFileId(sampleFileId)).toBe(sampleFileId);
  });

  it("derives preview, embed, download, and view URLs", () => {
    const url = `https://drive.google.com/file/d/${sampleFileId}/view`;
    const derived = deriveGoogleDriveUrls(url);

    expect(derived).not.toBeNull();
    expect(derived?.fileId).toBe(sampleFileId);
    expect(derived?.downloadUrl).toBe(`https://drive.google.com/uc?export=download&id=${sampleFileId}`);
    expect(derived?.previewUrl).toBe(`https://drive.google.com/thumbnail?id=${sampleFileId}&sz=w1000`);
    expect(derived?.embedUrl).toBe(`https://drive.google.com/file/d/${sampleFileId}/preview`);
    expect(derived?.normalizedViewUrl).toBe(`https://drive.google.com/file/d/${sampleFileId}/view`);
  });

  it("rejects non-drive links and random strings", () => {
    expect(extractGoogleDriveFileId("https://example.com/file/123")).toBeNull();
    expect(extractGoogleDriveFileId("not-a-drive-url")).toBeNull();
    expect(extractGoogleDriveFileId("")).toBeNull();
    expect(isValidGoogleDriveUrl("https://dropbox.com/s/abcdef123")).toBe(false);
  });
});
