/**
 * Fluent UI's catalogue for the benchmark: the stories of its documentation site, from every package of the monorepo.
 *
 * @remarks
 * Forgebook's configuration has no key for Vite, so the additions go through the framework's plugins. The monorepo's
 * packages resolve to their sources through its `tsconfig` paths, as its Storybook registers them, and its stories
 * import Markdown as text, which its webpack rules read.
 *
 * @module
 */
import { readFile } from "node:fs/promises";

import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

const framework = react();

/** Markdown as text, which Vite has no rule for. */
const MARKDOWN = /\.md(\?.*)?$/;

/** What Fluent's Storybook sets in webpack. */
const fluentVite = {
  name: "bench-fluentui",
  enforce: "pre",
  load: async (id) => {
    if (!MARKDOWN.test(id)) return null;
    const text = await readFile(id.split("?")[0] ?? id, "utf8");
    return `export default ${JSON.stringify(text)};`;
  },
  config: () => ({ resolve: { tsconfigPaths: true } })
};

export default defineConfig({
  framework: {
    ...framework,
    vitePlugins: async () => [fluentVite, ...((await framework.vitePlugins?.()) ?? [])]
  },
  title: "Fluent UI",
  stories: [
    "../../../packages/react-components/!(react-headless-components-preview)/stories/src/**/index.stories.@(ts|tsx)",
    "../src/**/index.stories.@(ts|tsx)"
  ]
});
