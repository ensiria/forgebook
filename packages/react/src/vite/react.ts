/**
 * Forgebook's adapter for React, for the Vite plugin: `forgebookPlugin({ framework: react() })`.
 *
 * @module
 */
import type { FrameworkAdapter } from "forgebook/vite/adapter";
import type { PluginOption } from "vite";

/**
 * React, as the plugin reads its components: the docs module the docs' worker loads is this package's
 * `extractDocs.ts` (the props from the first parameter's type, events as `on*` props); the generated pages draw with
 * its renderer and write code with its JSX writer; Vite gets React's plugin.
 *
 * @returns the adapter.
 */
export const react = (): FrameworkAdapter => ({
  name: "react",
  docsModule: new URL("./extractDocs.ts", import.meta.url).href,
  pages: { frame: "@forgebook/react/frame", code: "@forgebook/react/code" },
  // Fast Refresh: an edited component updates in its frame and the story keeps its state
  vitePlugins: async (): Promise<readonly PluginOption[]> => {
    const { default: plugin } = await import("@vitejs/plugin-react");
    return [plugin()];
  }
});
