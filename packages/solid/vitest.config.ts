/**
 * The Solid package's tests, in two runs: the renderer in a simulated page, with Solid's browser build and its JSX made
 * into DOM nodes, and the server render on Node, with Solid's server build and its JSX made into strings. One module
 * graph cannot hold both builds of `solid-js/web` (`*.server.test.tsx` are the second run's).
 *
 * @module
 */
import { defineConfig } from "vitest/config";

import { solid } from "./src/vite/solid.ts";

/** The server run's files. */
const SERVER_TESTS = "test/**/*.server.test.{ts,tsx}";

export default defineConfig(async () => ({
  test: {
    projects: [
      {
        root: import.meta.dirname,
        plugins: [...((await solid().vitePlugins?.()) ?? [])],
        test: {
          name: "page",
          environment: "happy-dom",
          include: ["test/**/*.test.{ts,tsx}"],
          exclude: [SERVER_TESTS]
        }
      },
      {
        root: import.meta.dirname,
        plugins: [...((await solid({ ssr: true }).vitePlugins?.()) ?? [])],
        test: { name: "server", environment: "node", include: [SERVER_TESTS] }
      }
    ]
  }
}));
