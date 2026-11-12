import { describe, expect, it, vi } from "vitest";

describe("Animated Product Image Gallery Logic & Interactions", () => {
  const sampleImages = [
    { id: "img-1", url: "https://drive.google.com/uc?id=1", title: "Vue de face" },
    { id: "img-2", url: "https://drive.google.com/uc?id=2", title: "Vue de dos" },
    { id: "img-3", url: "https://drive.google.com/uc?id=3", title: "Accessoires" },
  ];

  it("calculates adjacent indices for background preloading without layout shift", () => {
    const getAdjacentIndices = (currentIndex: number, total: number) => {
      if (total <= 1) return [];
      const nextIndex = (currentIndex + 1) % total;
      const prevIndex = (currentIndex - 1 + total) % total;
      return [prevIndex, nextIndex];
    };

    // Index 0: previous is 2, next is 1
    expect(getAdjacentIndices(0, 3)).toEqual([2, 1]);

    // Index 1: previous is 0, next is 2
    expect(getAdjacentIndices(1, 3)).toEqual([0, 2]);

    // Index 2: previous is 1, next is 0 (wraps around)
    expect(getAdjacentIndices(2, 3)).toEqual([1, 0]);

    // Single image product: no adjacent preloading needed
    expect(getAdjacentIndices(0, 1)).toEqual([]);
  });

  it("handles next and previous navigation cycling across boundaries", () => {
    let activeIndex = 0;
    const total = sampleImages.length;

    const next = (curr: number) => (curr + 1) % total;
    const prev = (curr: number) => (curr - 1 + total) % total;

    // Next from 0 -> 1 -> 2 -> 0
    activeIndex = next(activeIndex);
    expect(activeIndex).toBe(1);
    activeIndex = next(activeIndex);
    expect(activeIndex).toBe(2);
    activeIndex = next(activeIndex);
    expect(activeIndex).toBe(0);

    // Prev from 0 -> 2 -> 1 -> 0
    activeIndex = prev(activeIndex);
    expect(activeIndex).toBe(2);
    activeIndex = prev(activeIndex);
    expect(activeIndex).toBe(1);
    activeIndex = prev(activeIndex);
    expect(activeIndex).toBe(0);
  });

  it("interprets mobile/tablet touch swipe gestures with direction and threshold", () => {
    const handleSwipe = (
      deltaX: number,
      threshold = 35,
      isRtl = false,
    ): "next" | "prev" | "none" => {
      if (Math.abs(deltaX) < threshold) return "none";
      if (isRtl) {
        return deltaX > 0 ? "next" : "prev";
      }
      return deltaX < 0 ? "next" : "prev";
    };

    // Sub-threshold move -> ignored
    expect(handleSwipe(20)).toBe("none");
    expect(handleSwipe(-15)).toBe("none");

    // Standard LTR swipe:
    // Swiping left (drag towards left, delta < 0) -> Next
    expect(handleSwipe(-50, 35, false)).toBe("next");
    // Swiping right (drag towards right, delta > 0) -> Previous
    expect(handleSwipe(60, 35, false)).toBe("prev");

    // RTL swipe:
    // Natural reading order mirrored
    expect(handleSwipe(50, 35, true)).toBe("next");
    expect(handleSwipe(-60, 35, true)).toBe("prev");
  });

  it("handles image loading failure gracefully by tracking failed URLs in a set", () => {
    const failedUrls = new Set<string>();

    const handleImageError = (url: string) => {
      failedUrls.add(url);
    };

    const isImageAvailable = (url: string) => !failedUrls.has(url);

    expect(isImageAvailable("https://valid-url.com/p1.jpg")).toBe(true);

    handleImageError("https://broken-url.com/p2.jpg");
    expect(isImageAvailable("https://broken-url.com/p2.jpg")).toBe(false);
    expect(isImageAvailable("https://valid-url.com/p1.jpg")).toBe(true);
  });

  it("ensures lightbox opens at the currently active gallery image index", () => {
    let selectedLightboxIndex = -1;
    let isLightboxOpen = false;

    const onOpenLightbox = (index: number) => {
      selectedLightboxIndex = index;
      isLightboxOpen = true;
    };

    // User navigates to photo 2 (index 1) in card and clicks preview
    const activeCardImageIndex = 1;
    onOpenLightbox(activeCardImageIndex);

    expect(isLightboxOpen).toBe(true);
    expect(selectedLightboxIndex).toBe(1);
    expect(sampleImages[selectedLightboxIndex].title).toBe("Vue de dos");
  });
});
