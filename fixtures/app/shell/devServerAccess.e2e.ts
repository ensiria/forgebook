/**
 * What a client of `forgebook dev` reaches on the fixture catalogue: a tool lists and reads no folder it names itself,
 * another site's page in a real browser reaches no module or API, and what is meant for them still works.
 *
 * @module
 */
import { createServer, type Server } from "node:http";

import { expect, type Page, test } from "@playwright/test";

/** A story of the fixture catalogue. */
const SELECT = "kit:inputs-selection-select--overview";

/** A text of this file, which only a read of it can give. */
const THIS_FILE_HOLDS = "A text of this file";

/** An address that asks for a group of this folder's files: what no module of the catalogue imports. */
const groupAddress = (origin: string, kind: string): string =>
  `${origin}/@id/__x00__virtual:forgebook-${kind}:${import.meta.dirname}::0::devServerAccess*`;

/** Runs a function with a page of another site open: `localhost` is not the catalogue's `127.0.0.1`. */
const onAnotherSite = async (page: Page, run: () => Promise<void>): Promise<void> => {
  const server: Server = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html");
    response.end("<!doctype html><title>Another site</title>");
  });
  await new Promise<void>((resolve) => server.listen(0, "localhost", resolve));
  try {
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("The page's server has no port");
    await page.goto(`http://localhost:${address.port}/`);
    await run();
  } finally {
    server.close();
  }
};

/** The origins of the page's catalogue and of its story's frame. */
const originsOf = async (page: Page): Promise<{ readonly catalogue: string; readonly frames: string }> => {
  await page.goto(`/?story=${SELECT}`);
  await expect(
    page.frameLocator("iframe.forgebook-frame-view").locator("html[data-forgebook-status='ready']")
  ).toHaveCount(1);
  const src = await page.locator("iframe.forgebook-frame-view").getAttribute("src");
  return { catalogue: new URL(page.url()).origin, frames: new URL(src ?? "", page.url()).origin };
};

test.describe("forgebook dev's clients", () => {
  test("a tool names a folder and gets nothing of it, on either port", async ({ page }) => {
    const { catalogue, frames } = await originsOf(page);
    for (const origin of [catalogue, frames]) {
      for (const kind of ["files", "docs-pages", "search", "search-pages", "usage", "reach"]) {
        for (const headers of [{ "sec-fetch-dest": "script" }, { origin: "https://evil.example" }]) {
          const answer = await fetch(groupAddress(origin, kind), { headers });
          const body = await answer.text();
          expect(body).not.toContain(THIS_FILE_HOLDS);
          expect(body).not.toContain("devServerAccess.e2e.ts");
        }
      }
    }
  });

  test("a tool asks the agent API and the catalogue answers, with no browser's headers", async ({ page }) => {
    const { catalogue, frames } = await originsOf(page);
    const answer = await fetch(`${catalogue}/__forgebook/api/stories`);
    expect(answer.status).toBe(200);
    const document: unknown = await answer.json();
    expect(document).toMatchObject({ schema: 1 });
    // a frame's port never answers it, whoever asks
    expect((await fetch(`${frames}/__forgebook/api/stories`)).status).toBe(403);
  });

  test("another site's page in a browser reaches no module or API", async ({ page }) => {
    const { catalogue, frames } = await originsOf(page);
    await onAnotherSite(page, async () => {
      for (const origin of [catalogue, frames]) {
        const stories = `${origin}/__forgebook/api/stories`;
        const reached = await page.evaluate(
          async ([api, group]: readonly string[]) => {
            const asScript = (src: string | undefined): Promise<boolean> =>
              new Promise((resolve) => {
                const script = document.createElement("script");
                script.type = "module";
                script.src = src ?? "";
                script.onload = (): void => resolve(true);
                script.onerror = (): void => resolve(false);
                document.head.append(script);
              });
            const read = await fetch(api ?? "", { mode: "no-cors" }).then(
              (response) => response.type === "basic",
              () => false
            );
            return { read, script: await asScript(group) };
          },
          [stories, groupAddress(origin, "files")] as const
        );
        expect(reached.read).toBe(false);
        expect(reached.script).toBe(false);
      }
    });
  });

  test("another site's frame opens a module's address to nothing, and an embed to the story", async ({
    page
  }) => {
    const { catalogue } = await originsOf(page);
    await onAnotherSite(page, async () => {
      const moduleAnswer = page.waitForResponse((response) => response.url().includes("/@vite/client"));
      await page.evaluate((src: string) => {
        const frame = document.createElement("iframe");
        frame.src = src;
        document.body.append(frame);
      }, `${catalogue}/@vite/client`);
      expect((await moduleAnswer).status()).toBe(403);
      await page.evaluate((src: string) => {
        const frame = document.createElement("iframe");
        frame.id = "embed";
        frame.src = src;
        document.body.append(frame);
      }, `${catalogue}/?story=${SELECT}&embed`);
      const story = page.frameLocator("#embed").frameLocator("iframe.forgebook-frame-view");
      await expect(story.locator("html[data-forgebook-status='ready']")).toHaveCount(1);
    });
  });
});
