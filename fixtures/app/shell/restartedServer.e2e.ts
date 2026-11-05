/**
 * A catalogue's page across a restart of `forgebook dev`, on a server of its own: a tab that reloads when the server is
 * back, and one whose socket never notices, which asks for a search index first thing in the new server's life.
 *
 * @module
 */
import { type ChildProcess, spawn } from "node:child_process";
import { connect, createServer } from "node:net";
import { join } from "node:path";

import { type BrowserContext, expect, type Page, test } from "@playwright/test";

/** The catalogue's folder. */
const CATALOGUE = join(import.meta.dirname, "..", "..", "html");

/** The `forgebook` command's entry. */
const ENTRY = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "packages",
  "forgebook",
  "bin",
  "forgebook",
  "forgebook.mts"
);

/** A story of the catalogue. */
const STORY = "html:inputs-button--default";

/** What the search shows when a part of its index cannot be read. */
const SEARCH_FAILED = "Part of the docs could not be read";

/** A free port. */
const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => {
        if (address === null || typeof address === "string") reject(new Error("The probe has no port"));
        else resolve(address.port);
      });
    });
  });

/** Whether a port takes a connection: no request, as a page's would make the server read its modules. */
const isListening = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });

/** A dev server of this spec's: stops, and starts again on its ports with the disk's caches. */
type Server = {
  /** The catalogue's address. */
  readonly origin: string;
  /** Stops the server and starts it again, resolved once it listens. */
  readonly restart: () => Promise<void>;
  /** Stops it. */
  readonly stop: () => Promise<void>;
};

/** Starts `forgebook dev` on the catalogue, on free ports. */
const startServer = async (): Promise<Server> => {
  const port = await freePort();
  const framePort = await freePort();
  let child: ChildProcess | undefined;
  const start = async (): Promise<void> => {
    const args = ["--port", String(port), "--frame-port", String(framePort), "--host", "127.0.0.1"];
    child = spawn(process.execPath, [ENTRY, "dev", ...args], { cwd: CATALOGUE, stdio: "ignore" });
    await expect.poll(() => isListening(port), { timeout: 60_000 }).toBe(true);
  };
  const stop = async (): Promise<void> => {
    const stopping = child;
    if (stopping === undefined || stopping.exitCode !== null || stopping.signalCode !== null) return;
    await new Promise((resolve) => {
      stopping.once("exit", resolve);
      // as a crash or a closed terminal ends it: an orderly close is not what a page left open is about
      stopping.kill("SIGKILL");
    });
    await expect.poll(() => isListening(port)).toBe(false);
  };
  await start();
  return {
    origin: `http://127.0.0.1:${port}`,
    restart: async (): Promise<void> => {
      await stop();
      await start();
    },
    stop
  };
};

/** Opens the catalogue's story in a new tab, and waits for its frame. */
const openStory = async (context: BrowserContext, origin: string): Promise<Page> => {
  const page = await context.newPage();
  await page.goto(`${origin}/?story=${STORY}`);
  await expect(
    page.frameLocator("iframe.forgebook-frame-view").locator("html[data-forgebook-status='ready']")
  ).toHaveCount(1, { timeout: 60_000 });
  return page;
};

/** Searches the catalogue from a tab: its index read whole, and no part of the answer left out. */
const expectSearchFinds = async (page: Page): Promise<void> => {
  const index = page.waitForResponse((response) => response.url().includes("virtual:forgebook-search"));
  await page.getByRole("searchbox").fill("button");
  const answer = await index;
  expect(answer.status()).toBe(200);
  expect(await answer.text()).not.toContain("export default null");
  await expect(page.getByText(/^\d+ results?$/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(SEARCH_FAILED)).toHaveCount(0);
};

test.describe("a restart of forgebook dev", () => {
  test.setTimeout(180_000);
  let server: Server;

  test.beforeEach(async () => {
    server = await startServer();
  });

  test.afterEach(async () => {
    await server.stop();
  });

  test("a tab whose socket never notices finds the whole search index", async ({ browser }) => {
    const context = await browser.newContext();
    // a socket that stays open: the page's client never sees the server go, so it does not reload
    await context.routeWebSocket(/.*/, () => {});
    const page = await openStory(context, server.origin);
    await server.restart();
    await expectSearchFinds(page);
    await context.close();
  });

  test("two tabs reload when it is back, and read their groups", async ({ browser }) => {
    const context = await browser.newContext();
    const tabs = [await openStory(context, server.origin), await openStory(context, server.origin)];
    const reloads = tabs.map((tab) => tab.waitForEvent("load", { timeout: 60_000 }));
    await server.restart();
    await Promise.all(reloads);
    for (const tab of tabs) {
      await expect(
        tab.frameLocator("iframe.forgebook-frame-view").locator("html[data-forgebook-status='ready']")
      ).toHaveCount(1, { timeout: 60_000 });
      await expectSearchFinds(tab);
    }
    await context.close();
  });
});
