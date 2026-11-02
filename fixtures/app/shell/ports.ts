/**
 * The ports the shell's browser tests listen on: the fixture app's from `FORGEBOOK_SHELL_PORT`, and each other
 * framework's fixture catalogue at an offset of its own from it.
 *
 * @module
 */

/** The port the fixture app listens on. */
export const SHELL_PORT = Number(process.env["FORGEBOOK_SHELL_PORT"] ?? "41721");

/** The port the Vue fixture catalogue listens on. */
export const VUE_PORT = SHELL_PORT + 1;

/** The port the plain HTML fixture catalogue listens on: clear of the offsets the other frameworks' fixtures take. */
export const HTML_PORT = SHELL_PORT + 6;
