/**
 * The plain HTML fixture catalogue: Forgebook over stories that return an HTML string or a DOM node. The shell's
 * browser tests see a catalogue whose frames load no framework run on it (`fixtures/app/shell/html.e2e.ts`).
 *
 * @module
 */
import { html } from "@forgebook/html/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: html(),
  title: "HTML fixture",
  sources: ["./stories.ts"],
  languages: [{ id: "it", label: "Italiano" }]
});
