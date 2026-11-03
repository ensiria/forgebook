/**
 * The queries the plugin answers with a module made from a file's text: a story file's code, its component's page, a
 * source's Markdown, a docs page.
 *
 * @remarks
 * Their own module, so the plugin and the modules that answer them share the names without the plugin loading what
 * answers them (the Markdown reader, the highlighter, the compiler) at start.
 *
 * @module
 */

/** The query that asks for a story file's code: each story's `render` as written. */
export const CODE_QUERY = "?forgebook-code";

/** The query that asks for a story file's component page: its documentation file as HTML. */
export const PAGE_QUERY = "?forgebook-page";

/** The query a source's Markdown file is imported with (its introduction on the home), answered with its HTML. */
export const MARKDOWN_QUERY = "?forgebook-markdown";

/** The query that asks for one docs page, compiled. */
export const DOCS_PAGE_QUERY = "?forgebook-docs-page";
