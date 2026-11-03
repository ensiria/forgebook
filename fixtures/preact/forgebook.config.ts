/**
 * The Preact fixture catalogue: Forgebook over Preact components. The shell's browser tests see a catalogue drawn by
 * Preact itself, with no React in its frames (`fixtures/app/shell/preact.e2e.ts`).
 *
 * @module
 */
import { preact } from "@forgebook/preact/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: preact(),
  title: "Preact fixture",
  sources: ["./stories.ts"],
  languages: [{ id: "it", label: "Italiano" }]
});
