/**
 * The ports the shell's browser tests listen on: the fixture app's from `FORGEBOOK_SHELL_PORT`, the Vue fixture's the
 * next one, the white-label catalogue's the one after, and three more for their frames.
 *
 * @module
 */

/** The port the fixture app listens on. */
export const SHELL_PORT = Number(process.env["FORGEBOOK_SHELL_PORT"] ?? "41721");

/** The port the Vue fixture catalogue listens on. */
export const VUE_PORT = SHELL_PORT + 1;

/** The port of the white-label catalogue (`white-label/forgebook.config.ts`): the one after the Vue fixture's. */
export const WHITE_LABEL_PORT = SHELL_PORT + 2;

/**
 * The port of each catalogue's frames, given on its command line: the default, the catalogue's port + 1, is the next
 * catalogue's port here, which the frames would take before that catalogue starts.
 *
 * @param catalogue - the catalogue's port.
 */
export const framePortOf = (catalogue: number): number => catalogue + 3;
