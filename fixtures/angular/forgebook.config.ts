/**
 * The Angular fixture catalogue: Forgebook over Angular components compiled ahead of time by Analog's plugin. The shell's
 * browser tests see a catalogue with no React of its own run on it (`fixtures/app/shell/angular.e2e.ts`).
 *
 * @module
 */
import { angular } from "@forgebook/angular/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: angular(),
  title: "Angular fixture",
  sources: ["./stories.ts"],
  languages: [{ id: "it", label: "Italiano" }]
});
