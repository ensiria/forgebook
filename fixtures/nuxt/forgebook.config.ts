/**
 * The Nuxt fixture catalogue: Forgebook over a small Nuxt 4 app's components, which use Nuxt's auto-imports, aliases,
 * router, data and state. The shell's browser tests run on it (`fixtures/app/shell/nuxt.e2e.ts`).
 *
 * @module
 */
import { nuxt } from "@forgebook/nuxt/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: nuxt(),
  title: "Nuxt fixture",
  sources: ["./stories.ts"],
  languages: [{ id: "it", label: "Italiano" }]
});
