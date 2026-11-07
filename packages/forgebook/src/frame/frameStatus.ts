/**
 * The attribute on a frame's root that says whether its story is shown: what the tests wait for, never a delay.
 *
 * @module
 */

/**
 * `ready` once the story rendered, what it waits for came and its play function is over; `error` when it could not
 * render; `pending` when the frame gave up waiting, or cannot tell, so what it shows was not seen in its final state: a
 * check reads that as not verified, never as passed.
 */
export const STATUS_ATTRIBUTE = "data-forgebook-status";

/** The root's attribute that says why the status is `pending`, in a sentence a person reads. */
export const PENDING_REASON_ATTRIBUTE = "data-forgebook-pending-reason";

/**
 * The root's attribute set on a story that says it stays in a loading state (`parameters.suspense.expected`): the frame
 * did not wait for it, and a check says so rather than let a preview turn the wait off unseen.
 */
export const NOT_AWAITED_ATTRIBUTE = "data-forgebook-not-awaited";

/** The root's attribute set once the frame's code runs; the page's guard against code that fails earlier reads it. */
export const FRAME_STARTED_ATTRIBUTE = "data-forgebook-started";

/** The class of the text saying why a frame's story could not be drawn: what a check reports as the reason. */
export const ERROR_MESSAGE_CLASS = "forgebook-frame-error__message";
