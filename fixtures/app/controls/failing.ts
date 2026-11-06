/**
 * A custom control that fails as it is mounted, so a test can see the panel keep working.
 *
 * @module
 */

/** Any value. */
export const schema = {};

/** Fails. */
export const mount = (): (() => void) => {
  throw new Error("this control always fails");
};
