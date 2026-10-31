/**
 * The visual tests' browser on a developer's machine: the Playwright container's Chromium, so fonts and rendering
 * are the same as in CI, where the tests run inside that image.
 *
 * @remarks
 * Published (`forgebook/testing/visual-browser`). A package's `visualBrowser.ts` beside its specs
 * exports a global setup that calls `startVisualBrowser` with its own port and container name and returns the
 * teardown. Needs Docker (OrbStack or Docker Desktop).
 *
 * @module
 */
import { execFileSync } from "node:child_process";

/** The Playwright image the reference images are made in, the version of `@playwright/test` the repo installs. */
export const PLAYWRIGHT_IMAGE = "mcr.microsoft.com/playwright:v1.64.1-noble";

/** Where the browser listens and the container it runs in. */
export type VisualBrowserOptions = {
  /** The port the container's browser listens on (the package's `browserPort`). */
  readonly port: number;
  /** The container's name, so a leftover one from an earlier run is replaced. */
  readonly container: string;
};

/** How long the browser may take to listen, in ms (the first run pulls the image). */
const START_TIMEOUT = 300_000;

/**
 * Whether the browser server answers: any HTTP answer counts. A bare TCP connection does not, because Docker accepts
 * connections on a published port before the server inside listens.
 */
const isAnswering = async (port: number): Promise<boolean> => {
  try {
    await fetch(`http://127.0.0.1:${port}/`);
    return true;
  } catch {
    return false;
  }
};

/** Runs docker, its output hidden unless it fails. */
const docker = (args: readonly string[]): string => execFileSync("docker", args, { encoding: "utf8" });

/**
 * Starts the container's browser.
 *
 * @param options - the port it listens on and the container's name.
 * @returns the teardown, which stops it.
 * @throws When Docker is not running.
 */
export const startVisualBrowser = async ({ port, container }: VisualBrowserOptions): Promise<() => void> => {
  try {
    docker(["info", "--format", "{{.ServerVersion}}"]);
  } catch {
    throw new Error(
      "The visual tests need Docker: start it (OrbStack or Docker Desktop), then run them again"
    );
  }
  docker(["rm", "--force", container]);
  const version = PLAYWRIGHT_IMAGE.split(":v")[1]?.split("-")[0] ?? "";
  docker([
    "run",
    "--detach",
    "--rm",
    "--name",
    container,
    "--publish",
    `127.0.0.1:${port}:${port}`,
    "--add-host",
    "host.docker.internal:host-gateway",
    PLAYWRIGHT_IMAGE,
    "npx",
    "--yes",
    `playwright@${version}`,
    "run-server",
    "--port",
    String(port),
    "--host",
    "0.0.0.0"
  ]);
  const deadline = Date.now() + START_TIMEOUT;
  while (!(await isAnswering(port))) {
    if (Date.now() > deadline) throw new Error(`The container's browser did not listen on ${port}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return (): void => {
    docker(["stop", container]);
  };
};
