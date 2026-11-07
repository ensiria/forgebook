/**
 * Whether this catalogue composes others (`refs`): a constant the plugin writes into the build (`define`), so a
 * catalogue that composes none has every part of composition removed from its shell, and its first load carries none of
 * it.
 *
 * @remarks
 * Read as a value that may be missing, so a shell bundled by something other than Forgebook's plugin (a test) runs with
 * composition off rather than failing on a name nobody defined.
 *
 * @module
 */

/** What the plugin writes: whether the configuration lists other catalogues. */
declare const __FORGEBOOK_REFS__: boolean | undefined;

/** Whether this catalogue composes others. */
export const HAS_REFS: boolean = typeof __FORGEBOOK_REFS__ !== "undefined" && __FORGEBOOK_REFS__ === true;
