/**
 * The fixture's server tests: the catalogue's plugin reads the stories' globs, and the stories load in a simulated page,
 * since some build DOM nodes.
 *
 * @module
 */
import { html } from "@forgebook/html/vite";
import { forgebookPlugin } from "forgebook/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [forgebookPlugin({ framework: html() })],
  test: { environment: "happy-dom" }
});
