/**
 * The Solid fixture catalogue: Forgebook over Solid components. The shell's browser tests see a catalogue whose stories
 * run once and take new args in place (`fixtures/app/shell/solid.e2e.ts`).
 *
 * @module
 */
import { solid } from "@forgebook/solid/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: solid(),
  title: "Solid fixture",
  sources: ["./stories.ts"],
  languages: [{ id: "it", label: "Italiano" }]
});
