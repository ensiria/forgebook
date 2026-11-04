/**
 * Forgebook's own mark: an open book whose two pages rise into a flame, in an ember gradient. The sidebar shows it for
 * a catalogue without a logo of its own, and the page's icon uses it then (`mountShell.tsx`).
 *
 * @remarks
 * One SVG text, drawn as an image (a data address), so its gradients never clash with ids in the page and the
 * sidebar and the icon cannot drift apart. `assets/forgebook-logo.svg` at the repository's root is the same drawing,
 * for the READMEs.
 *
 * @module
 */

/** The mark's SVG, on a 64 × 64 grid. */
export const FORGEBOOK_MARK_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
  "<defs>",
  '<linearGradient id="ember" x1="0" y1="1" x2="0.6" y2="0">',
  '<stop offset="0" stop-color="#E0115F"/><stop offset="0.5" stop-color="#FF5A1F"/><stop offset="1" stop-color="#FFB020"/>',
  "</linearGradient>",
  '<linearGradient id="ember-dark" x1="0" y1="1" x2="0.6" y2="0">',
  '<stop offset="0" stop-color="#B00E4C"/><stop offset="1" stop-color="#F0441A"/>',
  "</linearGradient>",
  "</defs>",
  '<path d="M30.5 56C16 53 8 41 13 27C15.5 20 20 15 23 8C24.5 20 28 25 30.5 31Z" fill="url(#ember-dark)"/>',
  '<path d="M33.5 56C48 53 57 40 51 25C48.5 18 44 13 42 4C39.5 18 36 24 33.5 31Z" fill="url(#ember)"/>',
  "</svg>"
].join("");

/** The mark as an image's address. */
export const FORGEBOOK_MARK_URL = `data:image/svg+xml,${encodeURIComponent(FORGEBOOK_MARK_SVG)}`;
