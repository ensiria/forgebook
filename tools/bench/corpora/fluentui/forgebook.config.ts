/**
 * Fluent UI's catalogue for the benchmark: the stories of its documentation site, from every package of the monorepo.
 *
 * @remarks
 * Forgebook's configuration has no key for Vite, so the additions go through the framework's plugins. The monorepo's
 * packages resolve to their sources through `tsconfig.base.all.json`, the map its documentation's Storybook registers:
 * the `tsconfig` nearest a story holds a smaller one. Its stories import Markdown as text, which its webpack rules read.
 *
 * @module
 */
import { readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

const framework = react();

/** Markdown as text, which Vite has no rule for. */
const MARKDOWN = /\.md(\?.*)?$/;

/** The monorepo's root, from this folder. */
const ROOT = resolve(import.meta.dirname, "../../..");

/** The folder of the packages no map holds, which `@fluentui/react-components/unstable` still exports. */
const DEPRECATED = resolve(ROOT, "packages/react-components/deprecated");

/** A deprecated package's source. */
const deprecatedAlias = (name) => ({
  find: new RegExp(`^@fluentui/${name}$`),
  replacement: resolve(DEPRECATED, name, "src/index.ts")
});

/** The packages' sources, by name, from the map Fluent's documentation uses. */
const packageAliases = () => {
  const { compilerOptions } = JSON.parse(readFileSync(resolve(ROOT, "tsconfig.base.all.json"), "utf8"));
  const paths = Object.entries(compilerOptions.paths).flatMap(([name, [path]]) =>
    name.includes("*") ? [] : [{ find: new RegExp(`^${name}$`), replacement: resolve(ROOT, path) }]
  );
  // webpack's mark of a package in a Sass import
  const sass = { find: /^~/, replacement: "" };
  // the migration stories import the older library by its built folder, which is its sources' layout
  const older = {
    find: /^@fluentui\/react\/lib\/(.*)$/,
    replacement: `${resolve(ROOT, "packages/react/src")}/$1`
  };
  return [sass, older, ...paths, ...readdirSync(DEPRECATED).map(deprecatedAlias)];
};

/** What Fluent's Storybook sets in webpack. */
const fluentVite = {
  name: "bench-fluentui",
  enforce: "pre",
  load: async (id) => {
    if (!MARKDOWN.test(id)) return null;
    const text = await readFile(id.split("?")[0] ?? id, "utf8");
    return `export default ${JSON.stringify(text)};`;
  },
  config: () => ({ resolve: { alias: packageAliases() } })
};

export default defineConfig({
  framework: {
    ...framework,
    vitePlugins: async () => [fluentVite, ...((await framework.vitePlugins?.()) ?? [])]
  },
  title: "Fluent UI",
  // "Used in" holds one TypeScript program per package at once: here that fills the docs worker's heap and stops it,
  // and with it every story's docs still waiting
  usedIn: false,
  stories: [
    "../../../packages/react-components/!(react-headless-components-preview)/stories/src/**/index.stories.@(ts|tsx)",
    "../src/**/index.stories.@(ts|tsx)"
  ]
});
