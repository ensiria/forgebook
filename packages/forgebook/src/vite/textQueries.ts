/**
 * The queries the plugin answers with a module made from a file: a story file's docs and code, its component's page, a
 * source's Markdown, a docs page.
 *
 * @remarks
 * Their own module, so the plugin and the modules that answer them share the names without the plugin loading what
 * answers them (the Markdown reader, the highlighter, the compiler) at start.
 *
 * @module
 */

/** The query that asks for a story file's component docs. */
export const DOCS_QUERY = "?forgebook-docs";

/** The query that asks for a story file's code: each story's `render` as written. */
export const CODE_QUERY = "?forgebook-code";

/** The query that asks for a story file's component page: its documentation file as HTML. */
export const PAGE_QUERY = "?forgebook-page";

/** The query a source's Markdown file is imported with (its introduction on the home), answered with its HTML. */
export const MARKDOWN_QUERY = "?forgebook-markdown";

/** The query that asks for one docs page, compiled. */
export const DOCS_PAGE_QUERY = "?forgebook-docs-page";

/** The query that asks for the written home (`forgebook.home.md`), rendered: its file, then this. */
export const HOME_QUERY = "?forgebook-home";

/** The queries `textModules.ts` answers. */
export const TEXT_QUERIES: readonly string[] = [CODE_QUERY, PAGE_QUERY, MARKDOWN_QUERY];

/** The queries of a story file's modules the shell reads, which hand an edit to it in place on a dev server. */
export const RENEWED_QUERIES: readonly string[] = [DOCS_QUERY, CODE_QUERY, PAGE_QUERY];
