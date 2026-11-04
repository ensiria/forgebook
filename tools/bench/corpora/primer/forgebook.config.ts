/**
 * Primer React's catalogue for the benchmark: its own stories and its own Storybook preview, with what its
 * `.storybook/main.ts` adds to Vite.
 *
 * @remarks
 * Forgebook's configuration has no key for Vite, so the additions go through the framework's plugins. `__DEV__` is read
 * by its components, and its style sheets are CSS modules written for its PostCSS preset, which Lightning CSS, the
 * transformer Forgebook sets, would not run.
 *
 * @module
 */
import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";
import postcssPresetPrimer from "postcss-preset-primer";

const framework = react();

/** What `viteFinal` in Primer's Storybook sets. */
const primerVite = {
  name: "bench-primer",
  config: () => ({
    // biome-ignore lint/style/useNamingConvention: the name is Primer's, read by its components
    define: { __DEV__: "true" },
    css: {
      transformer: "postcss",
      modules: { generateScopedName: "prc-[folder]-[local]-[hash:base64:5]" },
      postcss: { plugins: [postcssPresetPrimer()] }
    }
  })
};

export default defineConfig({
  framework: {
    ...framework,
    vitePlugins: async () => [...((await framework.vitePlugins?.()) ?? []), primerVite]
  },
  title: "Primer",
  stories: ["../src/**/*.stories.@(js|jsx|ts|tsx)"],
  preview: "../.storybook/preview.jsx"
});
