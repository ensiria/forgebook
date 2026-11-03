/**
 * Slugs, as the blog's addresses write them: an auto-imported utility, used in a template.
 *
 * @module
 */

/**
 * A slug as a title.
 *
 * @param slug - the slug (`hello-world`).
 */
export const titleOfSlug = (slug: string): string =>
  slug
    .split("-")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
