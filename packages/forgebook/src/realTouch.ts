/**
 * The mark of a window where Chromium's own touch emulation runs (`forgebook dev --touch`): its pages see real touch,
 * so the catalogue's simulated touch stays off there. Shared by the window that sets it (`@forgebook/testing/touch`)
 * and the frame that reads it (`followTouch.ts`).
 *
 * @module
 */

/** The window property the touch window defines before any page script runs. */
export const REAL_TOUCH_FLAG = "__forgebookRealTouch";

/**
 * Whether a window runs Chromium's real touch emulation.
 *
 * @param view - the window.
 */
export const isRealTouchWindow = (view: Window): boolean => REAL_TOUCH_FLAG in view;

/** What `forgebook dev --touch` asks of the testing package's touch window. */
export type TouchWindowRequest = {
  /** The catalogue's address. */
  readonly url: string;
};
