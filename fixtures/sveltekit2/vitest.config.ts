/**
 * The fixture's server tests: the catalogue's plugin reads the stories' globs, SvelteKit's adapter gives the `$app`
 * modules, Svelte's plugin compiles the components for the server, in Node.
 *
 * @module
 */
import { sveltekit } from "@forgebook/sveltekit/vite";
import { forgebookPlugin } from "forgebook/vite";
import { defineConfig } from "vitest/config";

const framework = sveltekit({ dir: import.meta.dirname });

export default defineConfig(async () => ({
  plugins: [forgebookPlugin({ framework }), ...((await framework.vitePlugins?.()) ?? [])],
  test: { environment: "node" }
}));
