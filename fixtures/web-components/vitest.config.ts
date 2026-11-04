/**
 * The fixture's server tests: the catalogue's plugin reads the stories' globs, and the stories load in Node with Lit's
 * DOM shim, as a server renders them.
 *
 * @module
 */
import { webComponents } from "@forgebook/web-components/vite";
import { forgebookPlugin } from "forgebook/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [forgebookPlugin({ framework: webComponents() })],
  test: { environment: "node", setupFiles: ["@lit-labs/ssr/lib/install-global-dom-shim.js"] }
});
