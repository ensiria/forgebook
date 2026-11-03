/**
 * The fixture's server tests: the catalogue's plugin reads the stories' globs, Analog's compiles the components, as the
 * catalogue does.
 *
 * @module
 */
import { angular } from "@forgebook/angular/vite";
import { forgebookPlugin } from "forgebook/vite";
import { defineConfig } from "vitest/config";

const framework = angular();

export default defineConfig(async () => ({
  plugins: [forgebookPlugin({ framework }), ...((await framework.vitePlugins?.()) ?? [])],
  test: {
    environment: "node",
    // Angular's own packages are compiled in part, for a linker the tests do not run: the compiler finishes them
    setupFiles: ["@angular/compiler"],
    // Analog's plugin picks VM threads, for zone.js; the stories are zoneless, and Node aborts when that pool exits
    pool: "forks"
  }
}));
