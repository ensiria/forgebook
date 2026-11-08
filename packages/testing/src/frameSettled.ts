/**
 * Whether a story's frame has said what became of its story, as a page polls it until it has.
 *
 * @remarks
 * Run in the frame by Playwright's `waitForFunction`, so it reads nothing but the document. A frame that reloads itself
 * (on a cold dev server, when a dependency is prepared again) has no root element for a moment between its two
 * documents: a predicate that throws there ends the wait at once with that error, and the story would count as never
 * ready while it is still loading. So the root is read as one that may be missing.
 *
 * @module
 */

/**
 * Whether the frame's root carries a status: ready, failed or still waiting on purpose.
 *
 * @param attribute - the status's attribute (`STATUS_ATTRIBUTE`).
 */
export const isFrameSettled = (attribute: string): boolean =>
  ["ready", "error", "pending"].includes(document.querySelector("html")?.getAttribute(attribute) ?? "");
