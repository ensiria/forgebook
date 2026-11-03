/**
 * The fixture's server tests: the catalogue's plugin reads the stories' globs, Solid's compiles them for a server render,
 * on Node with Solid's server build.
 *
 * @module
 */
import { solid } from "@forgebook/solid/vite";
import { forgebookPlugin } from "forgebook/vite";
import { defineConfig } from "vitest/config";

const framework = solid({ ssr: true });

export default defineConfig(async () => ({
  plugins: [forgebookPlugin({ framework }), ...((await framework.vitePlugins?.()) ?? [])],
  test: { environment: "node" }
}));
