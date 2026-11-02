/**
 * The ports the shell's browser tests listen on: the fixture app's from `FORGEBOOK_SHELL_PORT`, the Vue fixture's the
 * next one, the Web Components fixture's the one after.
 *
 * @module
 */

/** The port the fixture app listens on. */
export const SHELL_PORT = Number(process.env["FORGEBOOK_SHELL_PORT"] ?? "41721");

/** The port the Vue fixture catalogue listens on. */
export const VUE_PORT = SHELL_PORT + 1;

/** The port the Web Components fixture catalogue listens on. */
export const WEB_COMPONENTS_PORT = SHELL_PORT + 2;
