/**
 * Forgebook's adapter for Nuxt, for the Vite plugin: `defineConfig({ framework: nuxt() })`.
 *
 * @remarks
 * Nuxt is Vue: the props are read as Vue's, and the stories drawn with Vue's renderer, each story's app given its Nuxt
 * (its router, data, state and config). What Nuxt adds is Vite's work: Vue's plugin, and this package's plugin for
 * Nuxt's aliases, auto-imports, components and `#imports` (`nuxtPlugin.ts`). Forgebook stays on Vite and does not run
 * Nuxt's build: a module's Vite plugins and style sheets are taken from the project's own Nuxt (`nuxtModules.ts`), and
 * what a module or a plugin does in Nuxt's runtime is not done.
 *
 * @module
 */
import { extname, resolve } from "node:path";

import { vue } from "@forgebook/vue/vite";
import type { AdapterContext, FrameworkAdapter } from "forgebook/vite/adapter";
import type { PluginOption } from "vite";

import { loadNuxtModules } from "./nuxtModules.ts";
import { FRAME_MODULE, nuxtPlugins } from "./nuxtPlugin.ts";

/** The options of `nuxt()`. */
export type NuxtOptions = {
  /** The Nuxt project's folder, from the catalogue's; the catalogue's own folder by default. */
  readonly dir?: string;
  /**
   * Whether to load the project's modules with its own Nuxt on every start of the catalogue, for what they give
   * components: their Vite plugins (Nuxt UI's Tailwind CSS, UnoCSS), style sheets, components, auto-imports, app config
   * and `#build/` files. `true` by default, unless the catalogue's `appBuild` is `false`. Loading them runs their code, as
   * `nuxt dev` does.
   */
  readonly loadModules?: boolean;
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
    // Vue's adapter is served from its files, as this package is (`nuxtPlugin.ts`): pre-bundled, the preview's
    // set-up module would be a copy apart from the one the renderer reads, and its set-ups would never run
    browserDependencies: [
      ...(base.browserDependencies ?? []).filter((name) => !name.startsWith("@forgebook/vue")),
      "vue-router",
      "forgebook/frame"
    ],
    ...(base.componentFiles === undefined ? {} : { componentFiles: base.componentFiles }),
    vitePlugins: async (context?: AdapterContext): Promise<readonly PluginOption[]> => {
      const isLoaded = options.loadModules !== false && context?.readsAppBuild !== false;
      const modules = isLoaded ? await loadNuxtModules(resolve(options.dir ?? ".")) : undefined;
      return [
        ...((await base.vitePlugins?.()) ?? []),
        ...nuxtPlugins(options, modules),
        ...(modules?.plugins ?? [])
      ];
    }
  };
};
