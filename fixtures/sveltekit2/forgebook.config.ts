/**
 * The SvelteKit 2 fixture catalogue: Forgebook over a SvelteKit 2 app's components and pages, so SvelteKit 2's
 * options, stores and environment are tested in every run, and its compatibility line has an app of its own.
 *
 * @module
 */

import { msw } from "@forgebook/plugin-msw";
import { sveltekit } from "@forgebook/sveltekit/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: sveltekit({ dir: import.meta.dirname }),
  title: "SvelteKit 2 fixture",
  sources: ["./stories.ts"],
  // its stories answer their fetches from mocks
  plugins: [msw()]
});
