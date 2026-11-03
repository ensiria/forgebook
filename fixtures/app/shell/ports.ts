/**
 * The ports the shell's browser tests listen on: the fixture app's from `FORGEBOOK_SHELL_PORT`, the other fixture
 * catalogues' after it, and each catalogue's frames' port after all of them.
 *
 * @module
 */

/** The port the fixture app listens on. */
export const SHELL_PORT = Number(process.env["FORGEBOOK_SHELL_PORT"] ?? "41721");

/** The port the white-label catalogue listens on: the one after the fixture app's. */
export const WHITE_LABEL_PORT = SHELL_PORT + 1;

/** The port the Next.js fixture catalogue listens on: a gap after the fixture app's, for the other frameworks'. */
export const NEXTJS_PORT = SHELL_PORT + 7;

/**
 * How far after its catalogue's port a catalogue's frames listen: past every catalogue's port, the gap kept for the
 * other frameworks' included, so the frames' default port (the catalogue's + 1) never takes the next catalogue's.
 */
const FRAMES_PORT_OFFSET = 10;

/**
 * The port a catalogue's frames listen on (`--frame-port`).
 *
 * @param port - the catalogue's port.
 */
export const framesPortOf = (port: number): number => port + FRAMES_PORT_OFFSET;
