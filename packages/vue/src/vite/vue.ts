/**
 * Forgebook's adapter for Vue, for the Vite plugin: `forgebookPlugin({ framework: vue() })`.
 *
 * @module
 */
import { extname } from "node:path";

import type { FrameworkAdapter } from "forgebook/vite/adapter";
import type { PluginOption, UserConfig } from "vite";

import { scriptOf } from "./sfcScript.ts";

/**
 * Vue's build with its template compiler. A story writes `template: "<Badge v-bind=\"args\" />"` as Storybook's Vue
 * stories do, and `vue` alone resolves to the runtime that cannot compile one. Only a catalogue's pages load it, so an
 * app built with its own components is not touched.
 */
const FULL_BUILD = "vue/dist/vue.esm-bundler.js";

/**
 * The Vite plugin that gives a catalogue Vue's full build.
 *
 * @returns the plugin.
 */
const templateCompiler = (): PluginOption => ({
  name: "forgebook:vue-templates",
  enforce: "pre",
  config: (): UserConfig => ({ resolve: { alias: [{ find: /^vue$/, replacement: FULL_BUILD }] } })
});

/**
 * Vue, as the plugin reads its components: the docs module the docs' worker loads is this package's `extractDocs.ts`
 * (the props, events and slots through `vue-component-meta`, single-file components included); the generated pages draw
 * with its renderer and write code with its template writer; Vite gets Vue's plugin.
 *
 * @returns the adapter.
 */
export const vue = (): FrameworkAdapter => ({
  name: "vue",
  // beside this module, with its extension: `.ts` in the sources, `.js` once built for npm
  docsModule: new URL(`./extractDocs${extname(import.meta.url)}`, import.meta.url).href,
  pages: { frame: "@forgebook/vue/frame", code: "@forgebook/vue/code" },
  // the server render is named too: the page never runs it, but Vite meets its import in the renderer and would reload
  browserDependencies: [FULL_BUILD, "vue/server-renderer"],
  componentFiles: { extension: ".vue", scriptOf },
  // single-file components, and their hot updates: an edited component updates in its frame, keeping its state
  vitePlugins: async (): Promise<readonly PluginOption[]> => {
    const { default: plugin } = await import("@vitejs/plugin-vue");
    return [plugin(), templateCompiler()];
  }
});
