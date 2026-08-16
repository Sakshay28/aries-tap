// The one string that couples the trigger (a tapped row) to the flow (the modal
// island) without a shared import of either's code. Kept in its own tiny module
// so TapList can dispatch the event without bundling the whole review modal —
// and its Confetti/compression/action deps — into the first-screen chunk.

export const OPEN_REVIEW_EVENT = "aries:open-review";

// Fire from anywhere on the client to open the Review Experience.
export function openReview(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_REVIEW_EVENT));
  }
}
