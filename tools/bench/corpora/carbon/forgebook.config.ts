/**
 * Carbon's catalogue for the benchmark: its own stories and its own Storybook preview, with what its
 * `.storybook/main.ts` adds to Vite.
 *
 * @remarks
 * Forgebook's configuration has no key for Vite, so the additions go through the framework's plugins. Its stories are
 * JSX in `.js` files, which only its Babel preset compiles, and they import `.mdx` pages Forgebook does not read, which
 * are answered here with an empty page. Its stories are the files `.storybook/main.ts` globs: `*.stories.*`, and
 * `*-story.*` (the experimental Pagination's). That file also leaves out the stories of the components moved from
 * ibm-products (`productMigratedStoryGlobs`), which only its next major's Storybook shows; a pattern of Forgebook's
 * leaves nothing out, so they are listed here, and the definition's `expected` counts them: 657 stories where
 * Storybook lists 509, a larger index for Forgebook's timings alone.
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
  stories: [
    "../src/**/*.stories.js",
    "../src/**/*.stories.tsx",
    "../src/**/*-story.js",
    "../src/**/*-story.tsx"
  ],
  preview: "../.storybook/preview.js"
});
