/**
 * How a docs page is named in an address: its slug and a heading's anchor.
 *
 * @remarks
 * Apart from the rest of what the plugin and the shell share (`docPages.ts`) because the tree and the address need these
 * on every catalogue's first load, and a catalogue that opens no page must not pay for the rest. Pure.
 *
 * @module
 */

/**
 * A fragment read back as a heading's anchor: a `%` that encodes nothing stays as written.
 *
 * @param fragment - the fragment, without its `#`; none when there is none.
 * @returns the anchor; none for an empty fragment.
 */
export const anchorOf = (fragment: string | undefined): string | undefined => {
  if (fragment === undefined || fragment === "") return undefined;
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
};

/**
 * A page's slug: the part of its id after the source's, from its title.
 *
 * @remarks
 * As CSF writes ids (`kebab`), keeping every language's letters: a title in Japanese would otherwise have no slug at
 * all, and two such pages would collide. For a Latin title the two agree.
 *
 * @param title - the page's title.
 */
export const pageSlug = (title: string): string =>
  title
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
