/**
 * The ports the shell's browser tests listen on: the fixture app's from `FORGEBOOK_SHELL_PORT`, and the other frameworks'
 * fixtures the next ones (Vue, Solid, Preact).
 *
 * @module
 */

/** The port the fixture app listens on. */
export const SHELL_PORT = Number(process.env["FORGEBOOK_SHELL_PORT"] ?? "41721");

/** The port the Vue fixture catalogue listens on. */
export const VUE_PORT = SHELL_PORT + 1;

/** The port the Solid fixture catalogue listens on. */
export const SOLID_PORT = SHELL_PORT + 2;

/** The port the Preact fixture catalogue listens on. */
export const PREACT_PORT = SHELL_PORT + 3;
