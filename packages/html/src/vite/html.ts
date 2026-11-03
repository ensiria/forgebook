/**
 * Forgebook's adapter for plain HTML, for the Vite plugin: `forgebookPlugin({ framework: html() })`.
 *
 * @module
 */
import { extname } from "node:path";

import type { FrameworkAdapter } from "forgebook/vite/adapter";

/**
 * Plain HTML, as the plugin reads it: the docs module the docs' worker loads is this package's `extractDocs.ts` (the
 * args from the story function's first parameter, or from the type the meta names, with their TSDoc); the generated
 * pages draw a story's HTML string or DOM node and write a story drawn from its args as its function's call. No Vite
 * plugin and nothing to pre-bundle: the stories are plain modules. A story writes its args into HTML, so a shared
 * link's texts reach it only when they are plain words.
 *
 * @returns the adapter.
 */
export const html = (): FrameworkAdapter => ({
  name: "html",
  // beside this module, with its extension: `.ts` in the sources, `.js` once built for npm
  docsModule: new URL(`./extractDocs${extname(import.meta.url)}`, import.meta.url).href,
  pages: { frame: "@forgebook/html/frame", code: "@forgebook/html/code" },
  addressTexts: "plain"
});
