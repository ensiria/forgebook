/**
 * The catalogue's own browser tests: the shell and its frames, on the fixture catalogue (`forgebook.config.ts`), the flows
 * the unit tests cannot reach (the address, the panel, the stage, the keys, the errors).
 *
 * @remarks
 * Run with `pnpm --filter @fixture/app test:shell`. The ports come from `FORGEBOOK_SHELL_PORT`, so two worktrees can
 * run the tests at once. The white-label catalogue (`white-label/forgebook.config.ts`) and the Next.js fixture
 * catalogue run beside the fixture app, for a catalogue with no trace of Forgebook's look (`embed.e2e.ts`) and for what
 * a Next.js project's components need (`nextjs.e2e.ts`).
 *
 * @module
 */
import { join } from "node:path";

import { defineConfig } from "@playwright/test";

import { framesPortOf, NEXTJS_PORT, SHELL_PORT, WHITE_LABEL_PORT } from "./ports";

/**
 * A catalogue as an app runs it: the forgebook command over its configuration, no page of its own; with a cold
 * dependency cache every run, as a first start, so a page that reloads while Vite discovers a package fails here.
 *
 * @param folder - the catalogue's folder.
 * @param port - the port it listens on; its frames listen on their own (`framesPortOf`).
 * @param configFile - its configuration, relative to the folder; the folder's `forgebook.config.ts` when absent.
 */
const catalogueServer = (
  folder: string,
  port: number,
  configFile?: string
): { command: string; cwd: string; url: string; reuseExistingServer: boolean } => ({
  command: `pnpm exec forgebook dev${configFile === undefined ? "" : ` --config ${configFile}`} --host 127.0.0.1 --port ${port} --frame-port ${framesPortOf(port)} --force`,
  cwd: folder,
  url: `http://127.0.0.1:${port}/`,
  reuseExistingServer: false
});

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: "*.e2e.ts",
  fullyParallel: true,
  reporter: [["list"]],
  webServer: [
    catalogueServer(join(import.meta.dirname, ".."), SHELL_PORT),
    // a second catalogue, for what only shows on one that sets a whole theme and turns the branding off
    catalogueServer(join(import.meta.dirname, ".."), WHITE_LABEL_PORT, "white-label/forgebook.config.ts"),
    catalogueServer(join(import.meta.dirname, "..", "..", "nextjs"), NEXTJS_PORT)
  ],
  use: {
    browserName: "chromium",
    baseURL: `http://127.0.0.1:${SHELL_PORT}/`,
    viewport: { width: 1280, height: 900 }
  }
});
