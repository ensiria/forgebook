/**
 * The catalogue's own browser tests: the shell and its frames, on the fixture app (`test/fixtures/app`), the flows
 * the unit tests cannot reach (the address, the panel, the stage, the keys, the errors).
 *
 * @remarks
 * Run with `pnpm --filter @ensiria/forgebook test:shell`. The port comes from `FORGEBOOK_SHELL_PORT`, so two
 * worktrees can run the tests at once.
 *
 * @module
 */
import { join } from "node:path";

import { defineConfig } from "@playwright/test";

/** The port the fixture app listens on. */
const PORT = Number(process.env["FORGEBOOK_SHELL_PORT"] ?? "41721");

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: "*.e2e.ts",
  fullyParallel: true,
  reporter: [["list"]],
  webServer: {
    command: `pnpm exec vite --config ${join(import.meta.dirname, "..", "fixtures", "app", "vite.config.ts")} --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false
  },
  use: {
    browserName: "chromium",
    baseURL: `http://127.0.0.1:${PORT}/`,
    viewport: { width: 1280, height: 900 }
  }
});
