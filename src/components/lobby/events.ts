export const OPEN_TAFFETA_GALLERY_EVENT = "aries:open-taffeta-gallery";
export const OPEN_TAFFETA_STORY_EVENT = "aries:open-taffeta-story";

export function openTaffetaGallery(index: number = 0): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(OPEN_TAFFETA_GALLERY_EVENT, { detail: { index } })
    );
  }
}

export function openTaffetaStory(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_TAFFETA_STORY_EVENT));
  }
}

