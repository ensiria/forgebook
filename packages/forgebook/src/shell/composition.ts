/**
 * Whether this catalogue composes others (`refs`): a constant the plugin writes into the build (`define`), so a
 * catalogue that composes none has every part of composition removed from its shell, and its first load carries none of
 * it. And the composed catalogues themselves, set by `mountShell` behind that constant: a page holds one shell, so they
 * are a fact of the page, as the frames' origin is, and a shell that composes none keeps not even their name.
 *
 * @remarks
 * Read as a value that may be missing, so a shell bundled by something other than Forgebook's plugin (a test) runs with
 * composition off rather than failing on a name nobody defined.
 *
 * @module
 */

import type { ShellRefs } from "./refParts.tsx";

/** What the plugin writes: whether the configuration lists other catalogues. */
declare const __FORGEBOOK_REFS__: boolean | undefined;

/** Whether this catalogue composes others. */
export const HAS_REFS: boolean = typeof __FORGEBOOK_REFS__ !== "undefined" && __FORGEBOOK_REFS__ === true;

/** The composed catalogues, once `mountShell` set them. */
let pageRefs: ShellRefs | undefined;

/**
 * Sets the composed catalogues, before the shell renders.
 *
 * @param refs - the composed catalogues, if the generated page gives any.
 */
export const setShellRefs = (refs: ShellRefs | undefined): void => {
  pageRefs = refs;
};

/** The composed catalogues; none until `mountShell` set them, or for a catalogue that composes none. */
export const shellRefs = (): ShellRefs | undefined => pageRefs;
