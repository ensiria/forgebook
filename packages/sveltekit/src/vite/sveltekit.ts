/**
 * Forgebook's adapter for SvelteKit, for the Vite plugin: `defineConfig({ framework: sveltekit() })`.
 *
 * @remarks
 * SvelteKit is Svelte: the props are read as Svelte's, and the stories drawn with Svelte's renderer, wrapped so each
 * has its page, its data and its links (`@forgebook/sveltekit/frame`). What SvelteKit adds is Vite's work: Svelte's
 * plugin with the project's own Svelte options, the project's other plugins, and this package's plugin for SvelteKit's
 * modules, aliases and environment (`kitPlugin.ts`). SvelteKit's own plugins are left out: they build an app, and a
 * catalogue draws components.
 *
 * @module
 */
import { extname } from "node:path";

import { svelte } from "@forgebook/svelte/vite";
import type { FrameworkAdapter } from "forgebook/vite/adapter";
import type { PluginOption } from "vite";

import { kitPlugin } from "./kitPlugin.ts";
import { loadKitProject } from "./kitProject.ts";

/** The options of `sveltekit()`. */
export type SveltekitOptions = {
  /** The SvelteKit project's folder; the folder the command runs in by default. */
  readonly dir?: string;
  /**
   * The project's Vite configuration, from its folder, where SvelteKit 3 keeps its options; the one Vite would find
   * by default; `false` reads none (SvelteKit 2's `svelte.config.js` is read then, and the project's other plugins
   * are left out).
   */
  readonly viteConfig?: string | false;
};

/**
 * SvelteKit, as the plugin reads and draws its components.
 *
 * @param options - the project's folder and its Vite configuration.
 * @returns the adapter.
 */
export const sveltekit = (options: SveltekitOptions = {}): FrameworkAdapter => {
  const base = svelte();
  return {
    name: "sveltekit",
    // beside this module, with its extension: `.ts` in the sources, `.js` once built for npm
    docsModule: new URL(`./extractDocs${extname(import.meta.url)}`, import.meta.url).href,
    // the catalogue imports this package only: its own pages, which use Svelte's
    pages: { frame: "@forgebook/sveltekit/frame", code: "@forgebook/sveltekit/code" },
    browserDependencies: base.browserDependencies ?? [],
    ...(base.componentFiles === undefined ? {} : { componentFiles: base.componentFiles }),
    vitePlugins: async (): Promise<readonly PluginOption[]> => {
      const project = await loadKitProject(options.dir ?? process.cwd(), options.viteConfig);
      const withSvelte = project.svelte === undefined ? base : svelte({ plugin: project.svelte });
      return [...((await withSvelte.vitePlugins?.()) ?? []), ...project.plugins, kitPlugin(project)];
    }
  };
};
