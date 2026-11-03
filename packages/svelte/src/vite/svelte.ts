/**
 * Forgebook's adapter for Svelte, for the Vite plugin: `forgebookPlugin({ framework: svelte() })`.
 *
 * @module
 */
import { extname } from "node:path";

import type { FrameworkAdapter } from "forgebook/vite/adapter";
import type { PluginOption, UserConfig } from "vite";

import { scriptOf } from "./svelteScript.ts";

/** This package, whose renderer draws with a component of its own. */
const PACKAGE = "@forgebook/svelte";

/**
 * The Vite plugin that has Vite compile this package's component wherever the catalogue's modules run: a test in Node
 * would otherwise load the package as it is published, and Node cannot load a `.svelte` file.
 *
 * @returns the plugin.
 */
const ownComponent = (): PluginOption => ({
  name: "forgebook:svelte-host",
  config: (): UserConfig => ({ ssr: { noExternal: [PACKAGE] } })
});

/**
 * Svelte, as the plugin reads its components: the docs module the docs' worker loads is this package's `extractDocs.ts`
 * (the props, snippets and callback props through `svelte2tsx` and TypeScript); the generated pages draw with its renderer
 * and write code with its markup writer; Vite gets Svelte's plugin, which reads the project's `svelte.config.js`.
 *
 * @returns the adapter.
 */
export const svelte = (): FrameworkAdapter => ({
  name: "svelte",
  // beside this module, with its extension: `.ts` in the sources, `.js` once built for npm
  docsModule: new URL(`./extractDocs${extname(import.meta.url)}`, import.meta.url).href,
  pages: { frame: `${PACKAGE}/frame`, code: `${PACKAGE}/code` },
  // the server render is named too: the page never runs it, but Vite meets its import in the renderer and would reload
  browserDependencies: ["svelte/server"],
  componentFiles: { extension: ".svelte", scriptOf },
  // components and their hot updates: an edited component updates in its frame
  vitePlugins: async (): Promise<readonly PluginOption[]> => {
    const { svelte: sveltePlugin } = await import("@sveltejs/vite-plugin-svelte");
    return [sveltePlugin(), ownComponent()];
  }
});
