/**
 * The ports the shell's browser tests listen on, every one derived from `FORGEBOOK_SHELL_PORT`: each fixture catalogue
 * takes two in a row, its own and its frames'.
 *
 * @remarks
 * A catalogue's place in `CATALOGUES` gives its pair: the fixture app's is `SHELL_PORT` and `SHELL_PORT + 1`, the next
 * one's `SHELL_PORT + 2` and `SHELL_PORT + 3`, and so on. Pairs cannot overlap however many catalogues there are, so a
 * new catalogue is a name added at the end, with no offset to choose and none of the others moved. The frames take the
 * port after their catalogue's, the one `forgebook dev` gives them when none is set, so a catalogue started by hand
 * with the same `--port` serves its frames where the tests expect them. Two worktrees run the tests at once with
 * `FORGEBOOK_SHELL_PORT`s at least twice the number of catalogues apart.
 *
 * @module
 */

/** The port the fixture app listens on: the first of the suite's ports. */
export const SHELL_PORT = Number(process.env["FORGEBOOK_SHELL_PORT"] ?? "41721");

/**
 * The catalogues the suite runs, in the order their ports are handed out: a new one goes at the end, so the others keep
 * theirs.
 */
const CATALOGUES = [
  "app",
  "vue",
  "nextjs",
  "white-label",
  "svelte",
  "solid",
  "preact",
  "web-components",
  "html",
  "nuxt",
  "angular",
  "sveltekit",
  "react-native"
] as const;

/** A catalogue the suite runs. */
export type Catalogue = (typeof CATALOGUES)[number];

/**
 * The port a catalogue listens on (`--port`).
 *
 * @param catalogue - the catalogue.
 */
export const portOf = (catalogue: Catalogue): number => SHELL_PORT + 2 * CATALOGUES.indexOf(catalogue);

/**
 * The port a catalogue's frames listen on (`--frame-port`): the one after the catalogue's.
 *
 * @param catalogue - the catalogue.
 */
export const framesPortOf = (catalogue: Catalogue): number => portOf(catalogue) + 1;

/**
 * The address of a catalogue's page.
 *
 * @param catalogue - the catalogue.
 */
export const catalogueUrl = (catalogue: Catalogue): string => `http://127.0.0.1:${portOf(catalogue)}/`;
