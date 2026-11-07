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
import { storybookPreviewApi } from "./storybookPreviewApi.ts";

/**
 * React, as the plugin reads its components: the docs module the docs' worker loads is this package's
 * `extractDocs.ts` (the props from the first parameter's type, events as `on*` props); the generated pages draw with
 * its renderer and write code with its JSX writer; Vite gets React's plugin, and a story file's import of Storybook's
 * preview API reaches Forgebook's preview hooks.
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
  // what the frame's renderer and the JSX of the stories import in the frame; the server render is not among them,
  // since the frame page never imports it (`reactFrameRenderer.tsx`)
  // and Storybook's preview hooks, which a story file's import of Storybook's preview API reaches only once it is served
  browserDependencies: [
    "react",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "react-dom",
    "react-dom/client",
    "@forgebook/react/storybook-hooks"
  ],
  // Fast Refresh: an edited component updates in its frame and the story keeps its state; story files too, which the
  // frame draws anew since it calls them and React never mounts them (forgebook's `hotModules.ts`)
  vitePlugins: async (): Promise<readonly PluginOption[]> => {
    const { default: plugin } = await import("@vitejs/plugin-react");
    return [refreshThroughCasts(), plugin(reactPlugin), refreshAtOnce(), storybookPreviewApi()];
  }
});
