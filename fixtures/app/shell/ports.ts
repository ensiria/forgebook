/**
 * The ports the shell's browser tests listen on: the fixture app's from `FORGEBOOK_SHELL_PORT`, then the Vue fixture's,
 * the Svelte fixture's and the SvelteKit fixture's.
 *
 * @module
 */

/** The port the fixture app listens on. */
export const SHELL_PORT = Number(process.env["FORGEBOOK_SHELL_PORT"] ?? "41721");

/** The port the Vue fixture catalogue listens on. */
export const VUE_PORT = SHELL_PORT + 1;

/** The port the Svelte fixture catalogue listens on. */
export const SVELTE_PORT = SHELL_PORT + 2;

/** The port the SvelteKit fixture catalogue listens on. */
export const SVELTEKIT_PORT = SHELL_PORT + 3;
