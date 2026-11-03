/**
 * The anchors of a page's headings and of a component's props: the fragment an address carries, and where it points in
 * the page. Apart from the docs pages' other helpers, so the search, which names an anchor for each result, loads these
 * few lines and not the pages' code.
 *
 * @module
 */

/** What every heading's element id starts with. */
const HEADING_ID_PREFIX = "doc-";

/**
 * A heading's element id.
 *
 * @param anchor - its anchor, as the address's fragment writes it.
 */
export const headingElementId = (anchor: string): string => `${HEADING_ID_PREFIX}${anchor}`;

/** What every prop's anchor starts with: a heading's anchor never holds a dot, so the two cannot meet. */
const PROP_ANCHOR = "prop.";

/**
 * A prop's anchor, the fragment of its component page's address.
 *
 * @param name - the prop's name.
 * @param part - the part it belongs to; none for the component's own.
 */
export const propAnchor = (name: string, part?: string): string =>
  `${PROP_ANCHOR}${part === undefined ? "" : `${part}.`}${name}`;

/**
 * Where an anchor points in a page: a prop's row, which says its name in `data-prop` (`part.name` for a part's), or a
 * heading, by its element id.
 *
 * @param anchor - the anchor.
 */
export const anchorSelector = (anchor: string): string =>
  anchor.startsWith(PROP_ANCHOR)
    ? `[data-prop="${CSS.escape(anchor.slice(PROP_ANCHOR.length))}"]`
    : `[id="${CSS.escape(headingElementId(anchor))}"]`;
