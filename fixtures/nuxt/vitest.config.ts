/**
 * The fixture's server tests: the catalogue's plugin reads the stories' globs, Vue's compiles the components, Nuxt's
 * gives them their auto-imports and aliases.
 *
 * @module
 */
import { nuxt } from "@forgebook/nuxt/vite";
import { forgebookPlugin } from "forgebook/vite";
import { defineConfig } from "vitest/config";

const framework = nuxt();

export default defineConfig(async () => ({
  plugins: [forgebookPlugin({ framework }), ...((await framework.vitePlugins?.()) ?? [])],
  test: { environment: "happy-dom" }
}));
