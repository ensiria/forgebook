/**
 * A custom control with no schema, which the contract refuses.
 *
 * @module
 */

/** Draws nothing. */
export const mount = (): (() => void) => () => undefined;
