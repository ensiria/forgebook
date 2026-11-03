/**
 * Nuxt's head composables in a catalogue: `useHead`, `useSeoMeta` and their server and safe forms take what a
 * component sets and leave the frame's document alone, since the frame's head is the catalogue's.
 *
 * Internal: the code the plugin writes imports it (`#imports`, `#app`, `#components`); a story or a component imports
 * Nuxt's names as in the app, never this module, whose exports may change in any release.
 *
 * @module
 */

/** What a head composable returns: what changes the entry, and what removes it; neither has anything to do. */
export type HeadEntry = {
  /** Changes what the entry set. */
  readonly patch: (input: unknown) => void;
  /** Removes the entry. */
  readonly dispose: () => void;
};

/** An entry with nothing to change or remove. */
const ENTRY: HeadEntry = { patch: (): void => undefined, dispose: (): void => undefined };

/** Sets the page's head: the frame's head is the catalogue's, so nothing changes. */
export const useHead = (): HeadEntry => ENTRY;

/** Sets the page's head from values it escapes: nothing changes in a story. */
export const useHeadSafe = (): HeadEntry => ENTRY;

/** Sets the page's meta tags: nothing changes in a story. */
export const useSeoMeta = (): HeadEntry => ENTRY;

/** Sets the head on the server only: nothing, in the page. */
export const useServerHead = (): HeadEntry => ENTRY;

/** Sets the head on the server only, from values it escapes: nothing, in the page. */
export const useServerHeadSafe = (): HeadEntry => ENTRY;

/** Sets the meta tags on the server only: nothing, in the page. */
export const useServerSeoMeta = (): HeadEntry => ENTRY;
