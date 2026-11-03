/**
 * The Web Components fixture catalogue: Forgebook over Lit elements and a plain custom element. The shell's browser tests
 * see a catalogue whose frames load no React run on it (`fixtures/app/shell/webComponents.e2e.ts`).
 *
 * @module
 */
import { webComponents } from "@forgebook/web-components/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: webComponents(),
  title: "Web Components fixture",
  sources: ["./stories.ts"],
  languages: [{ id: "it", label: "Italiano" }]
});
