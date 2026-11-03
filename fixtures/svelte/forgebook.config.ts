/**
 * The Svelte fixture catalogue: Forgebook over Svelte 5 components. The shell's browser tests see a catalogue with no
 * React of its own run on it (`fixtures/app/shell/svelte.e2e.ts`).
 *
 * @module
 */
import { svelte } from "@forgebook/svelte/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: svelte(),
  title: "Svelte fixture",
  sources: ["./stories.ts"],
  languages: [{ id: "it", label: "Italiano" }]
});
