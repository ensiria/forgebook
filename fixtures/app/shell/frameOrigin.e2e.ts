/**
 * A story's frame on an origin of its own: what runs in it (the story's code, a value a shared link put in a prop)
 * cannot read or act on the catalogue, its agent API or the project's files, and everything a story did before still
 * works there.
 *
 * @remarks
 * The code a test evaluates in the frame stands for a script a story or a link would run: it has exactly the frame's
 * rights.
 *
 * @module
 */
import { createServer, type Server } from "node:http";
import { join } from "node:path";

import { expect, type Frame, type Page, test } from "@playwright/test";

/** A story whose options a message could change: an injected option would show in its list. */
const SELECT = "kit:inputs-selection-select--overview";

/** A file of the project that no module of the catalogue imports. */
const CONFIG_FILE = join(import.meta.dirname, "..", "forgebook.config.ts");

/** The story's frame element of the page. */
const frameElement = (page: Page) => page.locator("iframe.forgebook-frame-view");

/** Opens a story and waits for its frame to say it is ready; the frame, and the two origins. */
const openStory = async (
  page: Page,
  id: string
): Promise<{ readonly frame: Frame; readonly catalogue: string; readonly frames: string }> => {
  await page.goto(`/?story=${id}`);
  await expect(
    page.frameLocator("iframe.forgebook-frame-view").locator("html[data-forgebook-status='ready']")
  ).toHaveCount(1);
  const handle = await frameElement(page).elementHandle();
  const frame = await handle?.contentFrame();
  if (frame === null || frame === undefined) throw new Error("The story has no frame");
  return { frame, catalogue: new URL(page.url()).origin, frames: new URL(frame.url()).origin };
};

/** What a `fetch` from the frame got: its status, or `"refused"` when the browser blocked it. */
const fetchedFrom = (frame: Frame, address: string): Promise<number | "refused"> =>
  frame.evaluate(
    (url: string) =>
      fetch(url).then(
        (response) => response.status,
        () => "refused" as const
      ),
    address
  );

/** Whether a dynamic import in the frame loaded the module. */
const importedFrom = (frame: Frame, address: string): Promise<boolean> =>
  frame.evaluate(
    (url: string) =>
      import(/* @vite-ignore */ url).then(
        () => true,
        () => false
      ),
    address
  );

/**
 * What a module worker the frame starts reads through a static import, which the browser asks for as a worker's own
 * script: the module's default export as text, or `"refused"` when the import fails.
 */
const importedInWorker = (frame: Frame, address: string): Promise<string> =>
  frame.evaluate(
    (url: string) =>
      new Promise<string>((resolve) => {
        const code = `import text from ${JSON.stringify(new URL(url, location.href).href)}; postMessage(String(text));`;
        const worker = new Worker(URL.createObjectURL(new Blob([code], { type: "text/javascript" })), {
          type: "module"
        });
        worker.addEventListener("message", (event: MessageEvent) => resolve(String(event.data)));
        worker.addEventListener("error", () => resolve("refused"));
      }),
    address
  );

test.describe("a story's frame on its own origin", () => {
  test("runs on another origin than the catalogue, and cannot reach the catalogue's page", async ({
    page
  }) => {
    const { frame, catalogue, frames } = await openStory(page, SELECT);
    expect(frames).not.toBe(catalogue);
    const parentTitle = await frame.evaluate(() => {
      try {
        return window.parent.document.title;
      } catch {
        return "blocked";
      }
    });
    expect(parentTitle).toBe("blocked");
    expect(await fetchedFrom(frame, `${catalogue}/`)).not.toBe(200);
  });

  test("cannot call the agent API, on the catalogue's origin or on its own", async ({ page }) => {
    const { frame, catalogue } = await openStory(page, SELECT);
    expect(await fetchedFrom(frame, `${catalogue}/__forgebook/api/stories`)).not.toBe(200);
    expect(await fetchedFrom(frame, "/__forgebook/api/stories")).not.toBe(200);
    // the API itself still answers tools, which are not a page
    const answer = await page.request.get(`${catalogue}/__forgebook/api/stories`);
    expect(answer.status()).toBe(200);
  });

  test("cannot read the project's files, only the modules the catalogue imports", async ({ page }) => {
    const { frame, catalogue } = await openStory(page, SELECT);
    const file = `/@fs${CONFIG_FILE}`;
    expect(await fetchedFrom(frame, file)).toBe(403);
    expect(await fetchedFrom(frame, `${file}?raw`)).toBe(403);
    expect(await importedFrom(frame, `${file}?raw`)).toBe(false);
    expect(await fetchedFrom(frame, `${catalogue}${file}`)).not.toBe(200);
    // a worker's own imports are asked for as a worker's script, and its exports reach the page
    expect(await importedInWorker(frame, `${file}?raw&import`)).toBe("refused");
    // what the frame runs stays readable to it: the story's own module
    const storyModule = await frame.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .find((name) => name.includes("Select.stories.tsx"))
    );
    expect(storyModule).toBeDefined();
    expect(await fetchedFrom(frame, storyModule ?? "")).toBe(200);
  });

  test("serves no catalogue page on the frames' origin, and the catalogue sends its frame address there", async ({
    page
  }) => {
    const { frames, catalogue } = await openStory(page, SELECT);
    const home = await page.request.get(`${frames}/`);
    expect(home.status()).toBe(404);
    await page.goto(`${catalogue}/frame.html?story=${SELECT}`);
    expect(new URL(page.url()).origin).toBe(frames);
    await expect(page.locator("html[data-forgebook-status='ready']")).toHaveCount(1);
  });

  test("applies no message from a page that is not the catalogue", async ({ page }) => {
    const { frames } = await openStory(page, SELECT);
    const server: Server = createServer((_request, response) => {
      response.setHeader("Content-Type", "text/html");
      response.end(`<!doctype html><iframe src="${frames}/frame.html?story=${SELECT}"></iframe>`);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (address === null || typeof address === "string") throw new Error("The page's server has no port");
      await page.goto(`http://127.0.0.1:${address.port}/`);
      const story = page.frameLocator("iframe");
      await expect(story.locator("html[data-forgebook-status='ready']")).toHaveCount(1);
      await page.evaluate(() => {
        const target = document.querySelector("iframe")?.contentWindow;
        target?.postMessage({ type: "forgebook:args", args: { options: ["Injected"] } }, "*");
      });
      await page.waitForTimeout(300);
      await expect(story.getByRole("option", { name: "Injected" })).toHaveCount(0);
    } finally {
      server.close();
    }
  });

  test("keeps what a story used on the catalogue's origin: storage and the clipboard", async ({
    page,
    context
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const { frame } = await openStory(page, SELECT);
    await frameElement(page).click({ position: { x: 4, y: 4 } });
    const used = await frame.evaluate(async () => {
      window.localStorage.setItem("forgebook-test", "kept");
      await navigator.clipboard.writeText("copied");
      return {
        storage: window.localStorage.getItem("forgebook-test"),
        isFullscreenAllowed: document.fullscreenEnabled
      };
    });
    expect(used).toEqual({ storage: "kept", isFullscreenAllowed: true });
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("copied");
  });
});
