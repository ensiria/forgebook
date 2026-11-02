/**
 * The catalogue's own browser tests: the shell and its frames, on the fixture catalogue (`forgebook.config.ts`), the flows
 * the unit tests cannot reach (the address, the panel, the stage, the keys, the errors).
 *
 * @remarks
 * Run with `pnpm --filter @fixture/app test:shell`. The port comes from `FORGEBOOK_SHELL_PORT`, so two
 * worktrees can run the tests at once.
 *
 * @module
 */
import { join } from "node:path";

import { defineConfig } from "@playwright/test";

/** The port the fixture app listens on. */
const PORT = Number(process.env["FORGEBOOK_SHELL_PORT"] ?? "41721");

/** The port the same catalogue listens on with its generated home (`forgebook.generated.config.ts`): the next one. */
const GENERATED_PORT = PORT + 1;

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: "*.e2e.ts",
  fullyParallel: true,
  reporter: [["list"]],
  webServer: [
    {
      // the catalogue as an app runs it: the forgebook command over its configuration, no page of its own; with a cold
      // dependency cache every run, as a first start, so a page that reloads while Vite discovers a package fails here
      command: `pnpm exec forgebook dev --host 127.0.0.1 --port ${PORT} --force`,
      cwd: join(import.meta.dirname, ".."),
      url: `http://127.0.0.1:${PORT}/`,
      reuseExistingServer: false
    },
    {
      // the same catalogue without its written home, for the home every catalogue without one keeps (`home.e2e.ts`)
      command: `pnpm exec forgebook dev --config forgebook.generated.config.ts --host 127.0.0.1 --port ${GENERATED_PORT}`,
      cwd: join(import.meta.dirname, ".."),
      url: `http://127.0.0.1:${GENERATED_PORT}/`,
      reuseExistingServer: false
    }
  ],
  // where the tests of the generated home go (`home.e2e.ts`)
  metadata: { generatedHome: `http://127.0.0.1:${GENERATED_PORT}/` },
  use: {
    browserName: "chromium",
    baseURL: `http://127.0.0.1:${PORT}/`,
    viewport: { width: 1280, height: 900 }
  }
});
