/**
 * The Angular package's tests: the renderer draws stories in a simulated page, their components compiled ahead of time
 * by Analog's plugin, as a catalogue compiles them.
 *
 * @module
 */
import analog from "@analogjs/vite-plugin-angular";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [analog({ tsconfig: "tsconfig.spec.json" })],
  test: {
    environment: "happy-dom",
    // Angular's own packages are compiled in part, for a linker the tests do not run: the compiler finishes them
    setupFiles: ["@angular/compiler"],
    // Analog's plugin picks VM threads, for zone.js; the tests are zoneless, and Node aborts when that pool exits
    pool: "forks"
  }
});
