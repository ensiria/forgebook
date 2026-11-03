/**
 * Forgebook's adapter for Nuxt, for the Vite plugin: `defineConfig({ framework: nuxt() })`.
 *
 * @remarks
 * Nuxt is Vue: the props are read as Vue's, and the stories drawn with Vue's renderer, each story's app given its Nuxt
 * (its router, data, state and config). What Nuxt adds is Vite's work: Vue's plugin, and this package's plugin for
 * Nuxt's aliases, auto-imports, components and `#imports` (`nuxtPlugin.ts`). Forgebook stays on Vite and does not run
 * Nuxt's build: a Nuxt module's or plugin's work is not done.
 *
 * @module
 */
import { extname } from "node:path";

import { vue } from "@forgebook/vue/vite";
import type { FrameworkAdapter } from "forgebook/vite/adapter";
import type { PluginOption } from "vite";

import { FRAME_MODULE, nuxtPlugins } from "./nuxtPlugin.ts";

/** The options of `nuxt()`. */
export type NuxtOptions = {
  /** The Nuxt project's folder, from the catalogue's; the catalogue's own folder by default. */
  readonly dir?: string;
};

/**
 * Nuxt, as the plugin reads and draws its components.
 *
 * @param options - the Nuxt project's folder, when it is not the catalogue's.
 * @returns the adapter.
 */
export const nuxt = (options: NuxtOptions = {}): FrameworkAdapter => {
  const base = vue();
  return {
    name: "nuxt",
    // beside this module, with its extension: `.ts` in the sources, `.js` once built for npm
    docsModule: new URL(`./extractDocs${extname(import.meta.url)}`, import.meta.url).href,
    // both are this package's: a catalogue resolves only the packages it installs, and it need not install Vue's adapter
    pages: { frame: FRAME_MODULE, code: "@forgebook/nuxt/code" },
    browserDependencies: [...(base.browserDependencies ?? []), "vue-router", "forgebook/frame"],
    ...(base.componentFiles === undefined ? {} : { componentFiles: base.componentFiles }),
    vitePlugins: async (): Promise<readonly PluginOption[]> => [
      ...((await base.vitePlugins?.()) ?? []),
      ...nuxtPlugins(options)
    ]
  };
};
