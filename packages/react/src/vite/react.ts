/**
 * Forgebook's adapter for React, for the Vite plugin: `forgebookPlugin({ framework: react() })`.
 *
 * @module
 */
import { extname } from "node:path";

import type { FrameworkAdapter } from "forgebook/vite/adapter";
import type { PluginOption } from "vite";

import { refreshThroughCasts } from "./refreshThroughCasts.ts";

/**
 * React, as the plugin reads its components: the docs module the docs' worker loads is this package's
 * `extractDocs.ts` (the props from the first parameter's type, events as `on*` props); the generated pages draw with
 * its renderer and write code with its JSX writer; Vite gets React's plugin.
 *
 * @returns the adapter.
 */
export const react = (): FrameworkAdapter => ({
  name: "react",
  // beside this module, with its extension: `.ts` in the sources, `.js` once built for npm
  docsModule: new URL(`./extractDocs${extname(import.meta.url)}`, import.meta.url).href,
  pages: { frame: "@forgebook/react/frame", code: "@forgebook/react/code" },
  // what the renderer and the JSX of the stories import in the frame
  browserDependencies: ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom/client"],
  // Fast Refresh: an edited component updates in its frame and the story keeps its state
  vitePlugins: async (): Promise<readonly PluginOption[]> => {
    const { default: plugin } = await import("@vitejs/plugin-react");
    // story files too: Fast Refresh renews what React mounts, and the frame draws the stories anew, since it calls them
    // and React never mounts them (forgebook's `hotModules.ts`)
    return [refreshThroughCasts(), plugin()];
  }
});
