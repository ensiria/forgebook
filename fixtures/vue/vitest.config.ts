/**
 * The fixture's server tests: the catalogue's plugin reads the stories' globs, Vue's compiles its components.
 *
 * @module
 */
import { vue } from "@forgebook/vue/vite";
import { forgebookPlugin } from "forgebook/vite";
import { defineConfig } from "vitest/config";

const framework = vue();

export default defineConfig(async () => ({
  plugins: [forgebookPlugin({ framework }), ...((await framework.vitePlugins?.()) ?? [])],
  test: { environment: "happy-dom" }
}));
