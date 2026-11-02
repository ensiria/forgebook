/**
 * The ports the shell's browser tests listen on: the fixture app's from `FORGEBOOK_SHELL_PORT`, then the Vue fixture's
 * and the Nuxt fixture's.
 *
 * @module
 */

/** The port the fixture app listens on. */
export const SHELL_PORT = Number(process.env["FORGEBOOK_SHELL_PORT"] ?? "41721");

/** The port the Vue fixture catalogue listens on. */
export const VUE_PORT = SHELL_PORT + 1;

/** The port the Nuxt fixture catalogue listens on. */
export const NUXT_PORT = SHELL_PORT + 2;
