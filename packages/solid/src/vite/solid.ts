/**
 * Forgebook's adapter for Solid, for the Vite plugin: `forgebookPlugin({ framework: solid() })`.
 *
 * @module
 */
import { extname } from "node:path";

import { FORGEBOOK_FILES, type FrameworkAdapter } from "forgebook/vite/adapter";
import type { PluginOption } from "vite";

/** Options of Solid's own Vite plugin, as the adapter passes them on. */
export type SolidOptions = {
  /**
   * Compile the stories for a server render as well (`vite-plugin-solid`'s `ssr`): what the generated server tests
   * need, run by Vitest on Node, where Solid's JSX must become strings rather than DOM nodes. A catalogue needs none.
   * `false` by default.
   */
  readonly ssr?: boolean;
};

/**
 * Solid, as the plugin reads its components: the docs module the docs' worker loads is this package's `extractDocs.ts`
 * (the props from the first parameter's type, events as `on*` props); the generated pages draw with its renderer and
 * write code with the JSX writer; Vite gets Solid's plugin, which compiles the stories' JSX into the DOM operations its
 * signals update and refreshes an edited component in its frame. The core's own files are left to Vite: its shell is
 * React.
 *
 * @param options - Solid's plugin's options; none for a catalogue.
 * @returns the adapter.
 */
export const solid = (options: SolidOptions = {}): FrameworkAdapter => ({
  name: "solid",
  // beside this module, with its extension: `.ts` in the sources, `.js` once built for npm
  docsModule: new URL(`./extractDocs${extname(import.meta.url)}`, import.meta.url).href,
  pages: { frame: "@forgebook/solid/frame", code: "@forgebook/solid/code" },
  browserDependencies: ["solid-js", "solid-js/web"],
  vitePlugins: async (): Promise<readonly PluginOption[]> => {
    const { default: plugin } = await import("vite-plugin-solid");
    return [plugin({ exclude: [FORGEBOOK_FILES], ssr: options.ssr ?? false })];
  }
});
