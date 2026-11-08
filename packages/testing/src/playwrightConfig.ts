/**
 * The two Playwright configurations of a package's story tests: the browser tests on the host's Chromium, and the
 * visual tests in the Playwright container's browser, both on the package's own test instance of the frame page.
 *
 * @remarks
 * Published (`forgebook/testing/playwright`). The package keeps a folder with its specs
 * (`stories.spec.ts`, `visual.spec.ts`), its frame page (`frame.html`), the Vite config that serves it
 * (`vite.config.ts`, from `storyTestViteConfig`) and the visual tests' global setup (`visualBrowser.ts`, from
 * `startVisualBrowser`); each package names its own ports, so two packages' tests run side by side. In CI the visual
 * tests already run inside the Playwright image (`CI` set), so they use its browser directly.
 *
 * @module
 */
import { availableParallelism } from "node:os";

import type { PlaywrightTestConfig } from "@playwright/test";

/** Where a package's story tests live and the ports they use. */
export type StoryTestServer = {
  /** The folder of the specs, the frame page, its Vite config and the visual tests' global setup. */
  readonly dir: string;
  /** The port the test instance of the frame page listens on. */
  readonly port: number;
  /** The port the container's browser listens on, for the visual tests. */
  readonly browserPort: number;
  /** How many tests run at once; every core when left out or not a positive number. */
  readonly workers?: number;
  /**
   * How many times a failed test runs again; 2 in CI (`CI` set) and none elsewhere when left out, as Playwright's own
   * template has it. A retry that passes is reported as flaky, never as passed.
   */
  readonly retries?: number;
  /**
   * The command that runs Vite (`node ./node_modules/vite/bin/vite.js`); by default the package manager that runs
   * the tests runs it (`frameServerCommand`).
   */
  readonly vite?: string;
};

/** The command each package manager runs a dependency's binary with, by the name its user agent starts with. */
const RUNNERS: Readonly<Record<string, string>> = {
  pnpm: "pnpm exec vite",
  yarn: "yarn vite",
  bun: "bunx vite",
  npm: "npx vite"
};

/**
 * The command that runs Vite, through the package manager that runs the tests: the one its user agent names
 * (`npm_config_user_agent`, which every package manager sets for the scripts it runs), npx when none does.
 *
 * @param userAgent - the package manager's user agent (`pnpm/10.19.0 npm/? node/v24.15.0 darwin arm64`), if any.
 */
export const frameServerCommand = (userAgent: string | undefined): string => {
  const manager = userAgent?.split("/")[0] ?? "npm";
  return RUNNERS[manager] ?? "npx vite";
};

/** The workers to use. */
const workersOf = ({ workers }: StoryTestServer): number =>
  workers !== undefined && workers > 0 ? workers : availableParallelism();

/**
 * The test instance of the frame page, started by Playwright and stopped after the run.
 *
 * @remarks
 * The command runs in a shell (`sh`, or `cmd.exe` on Windows), so the config's path is in double quotes, which both
 * read: a folder with a space (`C:\Users\Ada Lovelace`) would split it into two arguments.
 */
const webServer = ({ dir, port, vite }: StoryTestServer): NonNullable<PlaywrightTestConfig["webServer"]> => ({
  command: `${vite ?? frameServerCommand(process.env["npm_config_user_agent"])} --config "${dir}/vite.config.ts" --host 127.0.0.1 --port ${port} --strictPort`,
  url: `http://127.0.0.1:${port}/frame.html`,
  reuseExistingServer: false
});

/**
 * How many times a failed test runs again: the package's count, or 2 in CI and none on a developer's machine. A CI
 * runner shared by many tests loses a test's browser now and then (`newPage` fails with "Target page, context or
 * browser has been closed" before the story opens), which says nothing of the story; locally a failure is to look at.
 *
 * @param server - the package's folder and ports, with its own count if it gives one.
 * @param ci - the `CI` variable, set by every CI service.
 */
export const retriesOf = ({ retries }: StoryTestServer, ci: string | undefined): number =>
  retries ?? (ci === undefined || ci === "" ? 0 : 2);

/**
 * The browser tests' configuration: `stories.spec.ts` in the host's Chromium.
 *
 * @param server - the package's folder and ports.
 */
export const storyTestConfig = (server: StoryTestServer): PlaywrightTestConfig => ({
  testDir: server.dir,
  testMatch: "stories.spec.ts",
  fullyParallel: true,
  workers: workersOf(server),
  retries: retriesOf(server, process.env["CI"]),
  reporter: [["list"]],
  webServer: webServer(server),
  use: { browserName: "chromium", baseURL: `http://127.0.0.1:${server.port}/` }
});

/**
 * The visual tests' configuration: `visual.spec.ts` against the reference images in `__screenshots__`, in the
 * Playwright container's browser (started by `visualBrowser.ts` on a developer's machine, already there in CI).
 *
 * @param server - the package's folder and ports.
 */
export const visualTestConfig = (server: StoryTestServer): PlaywrightTestConfig => {
  const isInContainer = process.env["CI"] !== undefined;
  return {
    testDir: server.dir,
    testMatch: "visual.spec.ts",
    snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
    fullyParallel: true,
    workers: workersOf(server),
    retries: retriesOf(server, process.env["CI"]),
    reporter: [["list"]],
    webServer: webServer(server),
    ...(isInContainer ? {} : { globalSetup: `${server.dir}/visualBrowser.ts` }),
    use: {
      browserName: "chromium",
      viewport: { width: 1024, height: 768 },
      baseURL: `http://${isInContainer ? "127.0.0.1" : "host.docker.internal"}:${server.port}/`,
      ...(isInContainer ? {} : { connectOptions: { wsEndpoint: `ws://127.0.0.1:${server.browserPort}/` } })
    }
  };
};
