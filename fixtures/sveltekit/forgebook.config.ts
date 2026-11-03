/**
 * The SvelteKit fixture catalogue: Forgebook over a SvelteKit 3 app's components and pages. The shell's browser tests
 * run on it (`fixtures/app/shell/sveltekit.e2e.ts`).
 *
 * @module
 */

import { msw } from "@forgebook/plugin-msw";
import { sveltekit } from "@forgebook/sveltekit/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: sveltekit({ dir: import.meta.dirname }),
  title: "SvelteKit fixture",
  sources: ["./stories.ts"],
  // its stories answer their fetches from mocks
  plugins: [msw()]
});
