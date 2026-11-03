/**
 * Carbon's catalogue for the benchmark: its own stories and its own Storybook preview, with what its
 * `.storybook/main.ts` adds to Vite.
 *
 * @remarks
 * Forgebook's configuration has no key for Vite, so the additions go through the framework's plugins. Its stories are
 * JSX in `.js` files, which only its Babel preset compiles, and they import `.mdx` pages Forgebook does not read, which
 * are answered here with an empty page.
 *
 * @module
 */

import { react as forgebookReact } from "@forgebook/react/vite";
import babel from "@rolldown/plugin-babel";
import { defineConfig } from "forgebook";

// its stories are JSX in `.js` files, which React's plugin reads only when told to
const framework = forgebookReact({ include: /\.[jt]sx?$/ });

/** What `viteFinal` in Carbon's Storybook sets, and the empty pages. */
const carbonVite = {
  name: "bench-carbon",
  enforce: "pre",
  load: (id) => (id.split("?")[0]?.endsWith(".mdx") ? "export default () => null;" : null),
  config: () => ({
    css: { transformer: "postcss", preprocessorOptions: { scss: { api: "modern" } } },
    server: { fs: { allow: ["../../.."] } },
    optimizeDeps: {
      exclude: ["@carbon/motion"],
      rolldownOptions: { moduleTypes: { ".js": "jsx" } }
    },
    resolve: {
      preserveSymlinks: true,
      alias: { "~@ibm/plex": "@ibm/plex", "~@ibm/plex/": "@ibm/plex/" }
    }
  })
};

export default defineConfig({
  framework: {
    ...framework,
    vitePlugins: async () => [
      carbonVite,
      ...((await framework.vitePlugins?.()) ?? []),
      babel({ presets: ["babel-preset-carbon"] })
    ]
  },
  title: "Carbon",
  stories: ["../src/**/*.stories.js", "../src/**/*.stories.tsx"],
  preview: "../.storybook/preview.js"
});
