/**
 * Another catalogue, built and deployed, composed into this one's sidebar (`refs`): the white-label catalogue, built
 * with its agents' index and served here on a host of its own with CORS, as a published catalogue would be, shown by the
 * kit's catalogue that composes it (`refs/forgebook.config.ts`).
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";

import { expect, type FrameLocator, type Page, test } from "@playwright/test";

import { catalogueUrl, REF_HOST_PORT } from "./ports";

/** The catalogue that composes the other. */
const COMPOSER = catalogueUrl("refs");

/** A story of the fixture's Select, in the composed catalogue. */
const STORY = "kit:inputs-selection-select--small";

/** The composed catalogue's origin. */
const REF_ORIGIN = `http://127.0.0.1:${REF_HOST_PORT}`;

/** The files' types, as a host sends them. */
const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml"
};

// one worker for the file: the host listens on one port, and the build is made once
test.describe.configure({ mode: "serial" });

/** The built catalogue and its host. */
let built = "";
let server: Server | undefined;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  built = mkdtempSync(join(tmpdir(), "forgebook-ref-"));
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "forgebook",
      "build",
      "--config",
      "white-label/forgebook.config.ts",
      "--agent-index",
      "--out",
      built
    ],
    { cwd: join(import.meta.dirname, ".."), encoding: "utf8", shell: process.platform === "win32" }
  );
  expect(result.status, result.stderr).toBe(0);
  server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", REF_ORIGIN).pathname;
    const file = normalize(join(built, path.endsWith("/") ? `${path}index.html` : path));
    // a published catalogue's host lets another catalogue read its index; the page itself needs no such header
    response.setHeader("Access-Control-Allow-Origin", "*");
    if (!file.startsWith(built) || !existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    response.end(readFileSync(file));
  });
  await new Promise<void>((done) => server?.listen(REF_HOST_PORT, "127.0.0.1", done));
});

test.afterAll(() => {
  server?.close();
  if (built !== "") rmSync(built, { recursive: true, force: true });
});

/** The composed catalogue's embed page, framed by the composing one. */
const refFrame = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-ref-story__frame");

/** The story's own frame, inside the composed catalogue's embed page. */
const storyFrame = (page: Page): FrameLocator => refFrame(page).frameLocator("iframe.forgebook-frame-view");

test("lists another catalogue after its own stories, and reads it only once opened", async ({ page }) => {
  const indexRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/forgebook-agent.json")) indexRequests.push(request.url());
  });
  await page.goto(COMPOSER);
  const section = page.getByRole("button", { name: "Ember UI" });
  await expect(section).toHaveAttribute("aria-expanded", "false");
  // once the page has settled: a fetch on mount would have gone by then
  await page.waitForLoadState("networkidle");
  expect(indexRequests).toEqual([]);

  await section.click();
  await expect(section).toHaveAttribute("aria-expanded", "true");
  const component = page.getByRole("button", { name: /Inputs › Selection › Select/ });
  await expect(component).toBeVisible();
  expect(indexRequests).toEqual([`${REF_ORIGIN}/forgebook-agent.json`]);

  await component.click();
  await page.getByRole("link", { name: "Small", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`[?&]ref=ember&story=${encodeURIComponent(STORY)}`));
  await expect(page.getByRole("heading", { level: 1, name: "Small" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open in Ember UI" })).toHaveAttribute(
    "href",
    `${REF_ORIGIN}/?story=${encodeURIComponent(STORY)}`
  );
  await expect(storyFrame(page).locator("html")).toHaveAttribute("data-forgebook-status", "ready");
});

test("shows the story read-only, with this catalogue's switches, as tall as it is", async ({ page }) => {
  await page.goto(`${COMPOSER}?ref=ember&story=${encodeURIComponent(STORY)}&theme=dark`);
  const frame = page.locator("iframe.forgebook-ref-story__frame");
  const address = new URL((await frame.getAttribute("src")) ?? "");
  expect(address.origin).toBe(REF_ORIGIN);
  expect(address.searchParams.has("embed")).toBe(true);
  expect(address.searchParams.get("theme")).toBe("dark");
  // the frame is the other origin's, sandboxed as a story's frame is: it cannot navigate this tab
  expect(await frame.getAttribute("sandbox")).not.toContain("allow-top-navigation");
  await expect(storyFrame(page).locator("html")).toHaveAttribute("data-theme", "dark");
  // the frame is as tall as the embed's page, which follows its story
  const embedHeight = (): Promise<number> =>
    refFrame(page)
      .locator("body")
      .evaluate((body) => Math.ceil(body.getBoundingClientRect().height));
  await expect
    .poll(async () => Math.abs(((await frame.boundingBox())?.height ?? 0) - (await embedHeight())))
    .toBeLessThanOrEqual(1);

  // a switch changed on this catalogue's toolbar reaches the story, without a reload of this page
  await page.getByRole("radio", { name: "Light", exact: true }).first().click({ force: true });
  await expect(page).toHaveURL(/[?&]ref=ember/);
  await expect(storyFrame(page).locator("html")).toHaveAttribute("data-theme", "light");
});

test("says why a catalogue cannot be read, and what it needs", async ({ page }) => {
  await page.goto(COMPOSER);
  await page.getByRole("button", { name: "Gone UI" }).click();
  await expect(page.getByText(/Gone UI could not be read: 404/)).toBeVisible();
  await expect(page.getByText(/--agent-index/)).toBeVisible();
});

test("takes a ref that names no composed catalogue for another site's mark, and shows its own story", async ({
  page
}) => {
  await page.goto(`${COMPOSER}?ref=newsletter&story=${encodeURIComponent(STORY)}`);
  await expect(page.locator("iframe.forgebook-ref-story__frame")).toHaveCount(0);
  const frame = page.frameLocator("iframe.forgebook-frame-view").first();
  await expect(frame.locator("html")).toHaveAttribute("data-forgebook-status", "ready");
  await expect(page.getByRole("heading", { level: 1, name: "Select" })).toBeVisible();
});
