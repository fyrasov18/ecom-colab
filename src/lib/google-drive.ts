/**
 * Google Drive URL parsing, validation, and link derivation utilities.
 * Supports file sharing links, preview/embed iframe URLs, and direct download links.
 */

// Regex to capture Google Drive file IDs:
// Format 1: drive.google.com/file/d/{fileId}/...
// Format 2: drive.google.com/open?id={fileId} or uc?id={fileId}
// Format 3: docs.google.com/file/d/{fileId}/...
const DRIVE_FILE_REGEX =
  /(?:drive\.google\.com\/(?:file\/d\/|open\?(?:.*&)?id=|uc\?(?:.*&)?id=)|docs\.google\.com\/(?:file\/d\/))(a-zA-Z0-9_-]+)/;

// More permissive match for Google Drive file IDs (typically 25 to 45 alphanumeric, dash, and underscore chars)
const STRICT_DRIVE_ID_REGEX = /^[a-zA-Z0-9_-]{20,}$/;

export interface GoogleDriveMediaUrls {
  fileId: string;
  previewUrl: string;
  embedUrl: string;
  downloadUrl: string;
  normalizedViewUrl: string;
}

/**
 * Extracts the file ID from a Google Drive share link, or null if invalid.
 */
export function extractGoogleDriveFileId(inputUrl: string): string | null {
  if (!inputUrl || typeof inputUrl !== "string") return null;
  const trimmed = inputUrl.trim();

  // If already just an ID:
  if (STRICT_DRIVE_ID_REGEX.test(trimmed) && !trimmed.includes("/") && !trimmed.includes(".")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname.includes("drive.google.com") && !hostname.includes("docs.google.com")) {
      return null;
    }

    // Check query params (?id=...)
    const queryId = parsed.searchParams.get("id");
    if (queryId && STRICT_DRIVE_ID_REGEX.test(queryId)) {
      return queryId;
    }

    // Check pathname: /file/d/{fileId}
    const match = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1] && STRICT_DRIVE_ID_REGEX.test(match[1])) {
      return match[1];
    }

    return null;
  } catch {
    // If not a valid standard URL, fallback regex
    const match = trimmed.match(DRIVE_FILE_REGEX);
    return match ? match[1] : null;
  }
}

/**
 * Validates whether the given URL is a valid Google Drive file URL.
 */
export function isValidGoogleDriveUrl(url: string): boolean {
  return extractGoogleDriveFileId(url) !== null;
}

/**
 * Derives Google Drive view, embed preview, direct thumbnail/image preview,
 * and direct download URLs from any valid Google Drive link or file ID.
 */
export function deriveGoogleDriveUrls(inputUrl: string): GoogleDriveMediaUrls | null {
  const fileId = extractGoogleDriveFileId(inputUrl);
  if (!fileId) return null;

  return {
    fileId,
    // Direct preview/thumbnail link (works for images and video thumbnails)
    previewUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
    // Embed URL for iframe preview (responsive player for videos and document/image viewer)
    embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
    // Direct 1-click download link
    downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
    // Normalized sharing view URL
    normalizedViewUrl: `https://drive.google.com/file/d/${fileId}/view`,
  };
}
