/**
 * The catalogue's own browser tests: the shell and its frames, on the fixture catalogue (`forgebook.config.ts`), the flows
 * the unit tests cannot reach (the address, the panel, the stage, the keys, the errors).
 *
 * @remarks
 * Run with `pnpm --filter @fixture/app test:shell`. The ports come from `FORGEBOOK_SHELL_PORT` (`ports.ts`), so two
 * worktrees can run the tests at once. The Vue, Svelte, Solid, Preact, Web Components, plain HTML, Angular, Next.js,
 * Nuxt and white-label catalogues run beside the fixture app, for what a catalogue of another framework must do
 * (`vue.e2e.ts`, `svelte.e2e.ts`, `solid.e2e.ts`, `preact.e2e.ts`, `webComponents.e2e.ts`, `html.e2e.ts`,
 * `angular.e2e.ts`), what a Next.js or a Nuxt project's components need (`nextjs.e2e.ts`, `nuxt.e2e.ts`) and a
 * catalogue with no trace of Forgebook's look (`embed.e2e.ts`).
 *
 * @module
 */
import { join } from "node:path";

import { defineConfig } from "@playwright/test";

import { type Catalogue, catalogueUrl, framesPortOf, portOf } from "./ports";

/**
 * A catalogue as an app runs it: the forgebook command over its configuration, no page of its own; with a cold
 * dependency cache every run, as a first start, so a page that reloads while Vite discovers a package fails here.
 *
 * @param folder - the catalogue's folder.
 * @param catalogue - which catalogue it is, for its ports (`ports.ts`): its frames listen on their own.
 * @param configFile - its configuration, relative to the folder; the folder's `forgebook.config.ts` when absent.
 */
const catalogueServer = (
  folder: string,
  catalogue: Catalogue,
  configFile?: string
): { command: string; cwd: string; url: string; reuseExistingServer: boolean } => ({
  command: `pnpm exec forgebook dev${configFile === undefined ? "" : ` --config ${configFile}`} --host 127.0.0.1 --port ${portOf(catalogue)} --frame-port ${framesPortOf(catalogue)} --force`,
  cwd: folder,
  url: catalogueUrl(catalogue),
  reuseExistingServer: false
});

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: "*.e2e.ts",
  fullyParallel: true,
  reporter: [["list"]],
  webServer: [
    catalogueServer(join(import.meta.dirname, ".."), "app"),
    catalogueServer(join(import.meta.dirname, "..", "..", "vue"), "vue"),
    catalogueServer(join(import.meta.dirname, "..", "..", "svelte"), "svelte"),
    catalogueServer(join(import.meta.dirname, "..", "..", "solid"), "solid"),
    catalogueServer(join(import.meta.dirname, "..", "..", "preact"), "preact"),
    catalogueServer(join(import.meta.dirname, "..", "..", "web-components"), "web-components"),
    catalogueServer(join(import.meta.dirname, "..", "..", "html"), "html"),
    // a second catalogue, for what only shows on one that sets a whole theme and turns the branding off
    catalogueServer(join(import.meta.dirname, ".."), "white-label", "white-label/forgebook.config.ts"),
    catalogueServer(join(import.meta.dirname, "..", "..", "nextjs"), "nextjs"),
    catalogueServer(join(import.meta.dirname, "..", "..", "nuxt"), "nuxt"),
    catalogueServer(join(import.meta.dirname, "..", "..", "angular"), "angular")
  ],
  use: {
    browserName: "chromium",
    baseURL: catalogueUrl("app"),
    viewport: { width: 1280, height: 900 }
  }
});
