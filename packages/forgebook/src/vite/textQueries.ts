/**
 * The queries a story file or a Markdown file is imported with, answered by `textModules.ts`: named here so the plugin
 * knows them without loading what answers them.
 *
 * @module
 */

/** The query that asks for a story file's code: each story's `render` as written. */
export const CODE_QUERY = "?forgebook-code";

/** The query that asks for a story file's component page: its documentation file as HTML. */
export const PAGE_QUERY = "?forgebook-page";

/** The query a source's Markdown file is imported with (its introduction on the home), answered with its HTML. */
export const MARKDOWN_QUERY = "?forgebook-markdown";

/** The query that asks for one docs page: its text, compiled. */
export const DOCS_PAGE_QUERY = "?forgebook-docs-page";

/** The id prefix of a group's search of its docs pages: its group follows, as in a pattern's module. */
export const PAGES_SEARCH_PREFIX = "virtual:forgebook-search-pages:";
