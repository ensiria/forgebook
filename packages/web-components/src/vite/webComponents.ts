/**
 * Forgebook's adapter for Web Components, for the Vite plugin: `forgebookPlugin({ framework: webComponents() })`.
 *
 * @module
 */
import { extname } from "node:path";

import type { FrameworkAdapter } from "forgebook/vite/adapter";

/**
 * Web Components, as the plugin reads them: the docs module the docs' worker loads is this package's `extractDocs.ts`
 * (attributes, properties, events, slots and parts from the Custom Elements Manifest, or from a Lit element's TypeScript
 * where there is none); the generated pages draw with Lit and write code as HTML. Custom elements need no Vite plugin:
 * they are plain modules.
 *
 * @returns the adapter.
 */
export const webComponents = (): FrameworkAdapter => ({
  name: "web-components",
  // beside this module, with its extension: `.ts` in the sources, `.js` once built for npm
  docsModule: new URL(`./extractDocs${extname(import.meta.url)}`, import.meta.url).href,
  pages: { frame: "@forgebook/web-components/frame", code: "@forgebook/web-components/code" },
  // what the renderer imports in the frame; the server render is loaded by a name no bundler follows, so it is not here
  browserDependencies: ["lit", "lit/directives/unsafe-html.js"]
});
