/**
 * The attribute on a frame's root that says whether its story is shown: what the tests wait for, never a delay.
 *
 * @module
 */

/** `ready` once the story rendered and its play function is over, `error` when it could not render. */
export const STATUS_ATTRIBUTE = "data-forgebook-status";

/** The root's attribute set once the frame's code runs; the page's guard against code that fails earlier reads it. */
export const FRAME_STARTED_ATTRIBUTE = "data-forgebook-started";
