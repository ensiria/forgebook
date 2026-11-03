/**
 * The ports the shell's browser tests listen on: the fixture app's from `FORGEBOOK_SHELL_PORT`, and the other fixture
 * catalogues' after it.
 *
 * @module
 */

/** The port the fixture app listens on. */
export const SHELL_PORT = Number(process.env["FORGEBOOK_SHELL_PORT"] ?? "41721");

/** The port the Vue fixture catalogue listens on. */
export const VUE_PORT = SHELL_PORT + 1;

/** The port the Next.js fixture catalogue listens on: a gap after the fixture app's, for the other frameworks'. */
export const NEXTJS_PORT = SHELL_PORT + 7;
