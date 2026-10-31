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
};

/** The workers to use. */
const workersOf = ({ workers }: StoryTestServer): number =>
  workers !== undefined && workers > 0 ? workers : availableParallelism();

/** The test instance of the frame page, started by Playwright and stopped after the run. */
const webServer = ({ dir, port }: StoryTestServer): NonNullable<PlaywrightTestConfig["webServer"]> => ({
  command: `pnpm exec vite --config ${dir}/vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
  url: `http://127.0.0.1:${port}/frame.html`,
  reuseExistingServer: false
});

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
