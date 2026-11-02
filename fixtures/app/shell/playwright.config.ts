/**
 * The catalogue's own browser tests: the shell and its frames, on the fixture catalogue (`forgebook.config.ts`), the flows
 * the unit tests cannot reach (the address, the panel, the stage, the keys, the errors).
 *
 * @remarks
 * Run with `pnpm --filter @fixture/app test:shell`. The ports come from `FORGEBOOK_SHELL_PORT`, so two worktrees can run
 * the tests at once. The Vue fixture catalogue runs beside the fixture app, for what a catalogue of another framework
 * must do (`vue.e2e.ts`).
 *
 * @module
 */
import { join } from "node:path";

import { defineConfig } from "@playwright/test";

import { SHELL_PORT, VUE_PORT } from "./ports";

/**
 * A catalogue as an app runs it: the forgebook command over its configuration, no page of its own; with a cold
 * dependency cache every run, as a first start, so a page that reloads while Vite discovers a package fails here.
 *
 * @param folder - the catalogue's folder.
 * @param port - the port it listens on.
 */
const catalogueServer = (folder: string, port: number) => ({
  command: `pnpm exec forgebook dev --host 127.0.0.1 --port ${port} --force`,
  cwd: folder,
  url: `http://127.0.0.1:${port}/`,
  reuseExistingServer: false
});

/** The port the white-label catalogue listens on: the next one, so worktrees that set the first stay apart. */
const WHITE_LABEL_PORT = SHELL_PORT + 2;

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: "*.e2e.ts",
  fullyParallel: true,
  reporter: [["list"]],
  webServer: [
    catalogueServer(join(import.meta.dirname, ".."), SHELL_PORT),
    {
      // a second catalogue, for what only shows on one that sets a whole theme and turns the branding off
      command: `pnpm exec forgebook dev --config white-label/forgebook.config.ts --host 127.0.0.1 --port ${WHITE_LABEL_PORT} --force`,
      cwd: join(import.meta.dirname, ".."),
      url: `http://127.0.0.1:${WHITE_LABEL_PORT}/`,
      reuseExistingServer: false
    },
    catalogueServer(join(import.meta.dirname, "..", "..", "vue"), VUE_PORT)
  ],
  use: {
    browserName: "chromium",
    baseURL: `http://127.0.0.1:${SHELL_PORT}/`,
    viewport: { width: 1280, height: 900 }
  }
});
