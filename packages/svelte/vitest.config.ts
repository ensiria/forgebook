/**
 * The Svelte package's tests, in two runs: in a simulated page (happy-dom, Svelte's components compiled for a page), and
 * in Node for the `*.server.test.ts` files (compiled for a server), since Svelte compiles a component apart for each.
 *
 * @module
 */
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [svelte()],
  test: {
    projects: [
      {
        extends: true,
        // Svelte's own runtime for a page, rather than the server's that Node's conditions pick
        resolve: { conditions: ["browser"] },
        test: {
          name: "page",
          environment: "happy-dom",
          include: ["test/**/*.test.ts"],
          exclude: ["test/**/*.server.test.ts"]
        }
      },
      { extends: true, test: { name: "server", environment: "node", include: ["test/**/*.server.test.ts"] } }
    ]
  }
});
