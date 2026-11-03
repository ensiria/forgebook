/**
 * The fixture's server tests: the catalogue's plugin reads the stories' globs, Svelte's compiles the components for the
 * server, in Node.
 *
 * @module
 */
import { svelte } from "@forgebook/svelte/vite";
import { forgebookPlugin } from "forgebook/vite";
import { defineConfig } from "vitest/config";

const framework = svelte();

export default defineConfig(async () => ({
  plugins: [forgebookPlugin({ framework }), ...((await framework.vitePlugins?.()) ?? [])],
  test: { environment: "node" }
}));
