/**
 * The ports the shell's browser tests listen on, every one derived from `FORGEBOOK_SHELL_PORT`: each fixture catalogue
 * takes two in a row, its own and its frames'.
 *
 * @remarks
 * A catalogue's place in `CATALOGUES` gives its pair: the fixture app's is `SHELL_PORT` and `SHELL_PORT + 1`, the next
 * one's `SHELL_PORT + 2` and `SHELL_PORT + 3`, and so on. Pairs cannot overlap however many catalogues there are, so a
 * new catalogue is a name added at the end, with no offset to choose and none of the others moved. The frames take the
 * port after their catalogue's, the one `forgebook dev` gives them when none is set, so a catalogue started by hand
 * with the same `--port` serves its frames where the tests expect them. The port after every pair is the static host of
 * a built catalogue another one composes (`REF_HOST_PORT`). Two worktrees run the tests at once with
 * `FORGEBOOK_SHELL_PORT`s at least twice the number of catalogues, plus one, apart.
 *
 * Every port stays below `FIRST_EPHEMERAL_PORT`. The system hands ports from its ephemeral range to outgoing
 * connections, the browser's and the test runner's to these very servers, and a port held that way cannot be listened
 * on: a catalogue whose port fell inside the range failed to start whenever a connection happened to hold it.
 *
 * @module
 */

/**
 * The lowest port any usual system hands to outgoing connections: Linux's default range starts here, macOS's and
 * Windows' higher, at 49152.
 */
const FIRST_EPHEMERAL_PORT = 32768;

/** The port the fixture app listens on: the first of the suite's ports. */
export const SHELL_PORT = Number(process.env["FORGEBOOK_SHELL_PORT"] ?? "21721");

/**
 * The catalogues the suite runs, in the order their ports are handed out: a new one goes at the end, so the others keep
 * theirs.
 */
export const CATALOGUES = [
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
  "react-native",
  "generated-home",
  "parity",
  "themes",
  "refs"
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
 * The port of the static host that serves a built catalogue, for the catalogue that composes it (`refs.e2e.ts`): the
 * one after every catalogue's pair, so no catalogue's port moves.
 */
export const REF_HOST_PORT = SHELL_PORT + 2 * CATALOGUES.length;

// a port inside the ephemeral range fails a run now and then, never every time: refused at once, it cannot slip in
if (!Number.isInteger(SHELL_PORT) || SHELL_PORT < 1024 || REF_HOST_PORT >= FIRST_EPHEMERAL_PORT)
  throw new Error(
    `FORGEBOOK_SHELL_PORT=${String(SHELL_PORT)}: the suite's ports run from it to ${String(REF_HOST_PORT)}, and must ` +
      `stay between 1024 and ${String(FIRST_EPHEMERAL_PORT - 1)}, below the ports the system gives outgoing connections`
  );

/**
 * The address of a catalogue's page.
 *
 * @param catalogue - the catalogue.
 */
export const catalogueUrl = (catalogue: Catalogue): string => `http://127.0.0.1:${portOf(catalogue)}/`;
