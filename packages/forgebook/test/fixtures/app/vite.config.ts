/**
 * The fixture catalogue: the catalogue's pages over the fixture package, served for the catalogue's browser checks.
 *
 * @module
 */
import { defineConfig } from "vite";

import { forgebookPlugin } from "../../../src/vite/forgebookPlugin.ts";

export default defineConfig({
  root: import.meta.dirname,
  plugins: [forgebookPlugin()],
  build: { rolldownOptions: { input: { index: "index.html", frame: "frame.html" } } }
});
