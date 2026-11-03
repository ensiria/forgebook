/**
 * The fixture's server tests: the catalogue's plugin reads the stories' globs, and each file's JSX is Preact's, from its
 * `tsconfig.json`.
 *
 * @module
 */
import { preact } from "@forgebook/preact/vite";
import { forgebookPlugin } from "forgebook/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [forgebookPlugin({ framework: preact() })],
  test: { environment: "happy-dom" }
});
