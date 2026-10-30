/**
 * Forgebook's adapter for React, for the Vite plugin: `forgebookPlugin({ framework: react() })`.
 *
 * @module
 */
import type { FrameworkAdapter } from "forgebook/vite/adapter";

/**
 * React, as the plugin reads its components: the docs module the docs' worker loads is this package's
 * `extractDocs.ts` (the props from the first parameter's type, events as `on*` props).
 *
 * @returns the adapter.
 */
export const react = (): FrameworkAdapter => ({
  name: "react",
  docsModule: new URL("./extractDocs.ts", import.meta.url).href
});
