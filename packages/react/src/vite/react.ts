/**
 * Forgebook's adapter for React, for the Vite plugin: `forgebookPlugin({ framework: react() })`.
 *
 * @module
 */
import { extname } from "node:path";

import type { Options as ReactPluginOptions } from "@vitejs/plugin-react";
import type { FrameworkAdapter } from "forgebook/vite/adapter";
import type { PluginOption } from "vite";

import { refreshAtOnce } from "./refreshAtOnce.ts";
import { refreshThroughCasts } from "./refreshThroughCasts.ts";

/**
 * React, as the plugin reads its components: the docs module the docs' worker loads is this package's
 * `extractDocs.ts` (the props from the first parameter's type, events as `on*` props); the generated pages draw with
 * its renderer and write code with its JSX writer; Vite gets React's plugin.
 *
 * @param reactPlugin - the options of `@vitejs/plugin-react`, for a library whose files need them (JSX in `.js` files:
 * `{ include: /\.[jt]sx?$/ }`); its defaults by default. Forgebook's own plugins around it stay.
 * @returns the adapter.
 */
export const react = (reactPlugin: ReactPluginOptions = {}): FrameworkAdapter => ({
  name: "react",
  // beside this module, with its extension: `.ts` in the sources, `.js` once built for npm
  docsModule: new URL(`./extractDocs${extname(import.meta.url)}`, import.meta.url).href,
  pages: { frame: "@forgebook/react/frame", code: "@forgebook/react/code" },
  // what the renderer and the JSX of the stories import in the frame; the server render is named too: the page never
  // runs it, but Vite meets its import in the renderer and would reload
  browserDependencies: [
    "react",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "react-dom/client",
    "react-dom/server"
  ],
  // Fast Refresh: an edited component updates in its frame and the story keeps its state; story files too, which the
  // frame draws anew since it calls them and React never mounts them (forgebook's `hotModules.ts`)
  vitePlugins: async (): Promise<readonly PluginOption[]> => {
    const { default: plugin } = await import("@vitejs/plugin-react");
    return [refreshThroughCasts(), plugin(reactPlugin), refreshAtOnce()];
  }
});
