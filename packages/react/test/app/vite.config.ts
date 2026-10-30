/**
 * The fixture catalogue: the catalogue's pages over the fixture package, served for the catalogue's browser checks.
 *
 * @module
 */

import { forgebookPlugin } from "forgebook/vite";
import { defineConfig } from "vite";

import { react } from "../../src/vite/react.ts";

export default defineConfig({
  root: import.meta.dirname,
  plugins: [forgebookPlugin({ framework: react() })],
  build: { rolldownOptions: { input: { index: "index.html", frame: "frame.html" } } }
});
