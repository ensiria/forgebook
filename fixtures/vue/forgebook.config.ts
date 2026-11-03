/**
 * The Vue fixture catalogue: Forgebook over Vue components, single-file ones among them. The shell's browser tests see a
 * catalogue with no React of its own run on it (`fixtures/app/shell/vue.e2e.ts`).
 *
 * @module
 */
import { vue } from "@forgebook/vue/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: vue(),
  title: "Vue fixture",
  sources: ["./stories.ts"],
  languages: [{ id: "it", label: "Italiano" }]
});
