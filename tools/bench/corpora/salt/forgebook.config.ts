/**
 * Salt's catalogue for the benchmark: its own stories and its own Storybook preview, with what its
 * `.storybook/main.ts` adds to Vite.
 *
 * @remarks
 * Forgebook's configuration has no key for Vite, so the additions go through the framework's plugins. Its stories
 * import the packages' sources through the paths of its `tsconfig.json`, and its components inject their own style
 * sheets, which its Storybook reads as strings by adding `?inline` to their imports: the plugin that does it is a
 * TypeScript file of its monorepo, so its few lines are repeated here rather than loaded from there.
 *
 * @module
 */

import { fileURLToPath } from "node:url";

import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

const framework = react();

/** A file of the clone, as an absolute path: an alias is not read from the configuration's folder. */
const fromClone = (path: string): string => fileURLToPath(new URL(`../${path}`, import.meta.url));

/** Components' sources, whose style sheets their own code injects. */
const COMPONENT_SOURCE = /\/packages\/.*\.[jt]sx?$/;

/** Story files, whose style sheets Vite injects as usual. */
const STORY_FILE = /\.stories\.[jt]sx?$/;

/** What `viteFinal` in Salt's Storybook sets: the inline style sheets, the source paths and the CSS aliases. */
const saltVite = {
  name: "bench-salt",
  enforce: "pre",
  transform: (code: string, id: string) => {
    const file = id.split("?")[0] ?? id;
    if (!COMPONENT_SOURCE.test(file) || STORY_FILE.test(file) || file.includes("/node_modules/")) return null;
    return { code: code.replaceAll('.css";', '.css?inline";'), map: null };
  },
  config: () => ({
    resolve: {
      tsconfigPaths: true,
      alias: {
        "@salt-ds/ag-grid-theme/salt-ag-theme.css": fromClone("packages/ag-grid-theme/src/salt-ag-theme.css"),
        "@salt-ds/react-resizable-panels-theme/index.css": fromClone(
          "packages/react-resizable-panels-theme/src/index.css"
        ),
        "@salt-ds/theme/css/baseline.css": fromClone("packages/theme/src/css/baseline.css"),
        "@salt-ds/theme/css/experimental/salt-interim.css": fromClone(
          "packages/theme/src/css/experimental/salt-interim.css"
        ),
        "@salt-ds/theme/css/theme-next.css": fromClone("packages/theme/src/css/theme-next.css"),
        "@salt-ds/theme/index.css": fromClone("packages/theme/src/index.css")
      }
    }
  })
};

export default defineConfig({
  framework: {
    ...framework,
    vitePlugins: async () => [saltVite, ...((await framework.vitePlugins?.()) ?? [])]
  },
  title: "Salt",
  stories: ["../packages/*/stories/**/*.stories.@(js|jsx|ts|tsx)"],
  preview: "../.storybook/preview.tsx"
});
