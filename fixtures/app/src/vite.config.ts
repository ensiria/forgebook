/**
 * The fixture catalogue: the catalogue's pages over the fixture package, served for the catalogue's browser checks.
 *
 * @module
 */

import { react } from "@forgebook/react/vite";
import { forgebookPlugin } from "forgebook/vite";
import { defineConfig } from "vite";

export default defineConfig({
  root: import.meta.dirname,
  plugins: [forgebookPlugin({ framework: react() })],
  build: { rolldownOptions: { input: { index: "index.html", frame: "frame.html" } } }
});
