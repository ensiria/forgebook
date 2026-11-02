/**
 * Ids in the form CSF writes them, for the story tree, the docs pages and the tools that name them. Pure.
 *
 * @module
 */

/**
 * A text in lower-case kebab case, as CSF writes ids: every run of other characters becomes one `-`.
 *
 * @param text - any text.
 */
export const kebabCase = (text: string): string =>
  text
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
