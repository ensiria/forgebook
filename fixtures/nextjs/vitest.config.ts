/**
 * The fixture's server tests: the catalogue's plugin reads the stories' globs, Next.js's adapter gives the `next/*`
 * modules, in Node.
 *
 * @module
 */
import { nextjs } from "@forgebook/nextjs/vite";
import { forgebookPlugin } from "forgebook/vite";
import { defineConfig } from "vitest/config";

const framework = nextjs({ dir: import.meta.dirname, googleFonts: "none" });

export default defineConfig(async () => ({
  plugins: [forgebookPlugin({ framework }), ...((await framework.vitePlugins?.()) ?? [])],
  test: { environment: "node" }
}));
