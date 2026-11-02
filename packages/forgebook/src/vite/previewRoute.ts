/**
 * The name of the dev server's preview page under its answers' path, apart from the page's code so that the plugin can
 * know the route without loading it.
 *
 * @module
 */

/** The path of a story's preview page under `AGENT_API`. */
export const PREVIEW_ROUTE = "preview";

/**
 * The preview page's whole path, `AGENT_API` and `PREVIEW_ROUTE` (a test holds them together): the frames' guard reads
 * it without loading the answers' module.
 */
export const PREVIEW_PATH = "/__forgebook/api/preview";
