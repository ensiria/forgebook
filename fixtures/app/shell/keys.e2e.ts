/**
 * The shell's keys in the browser: a story keeps every key pressed in its frame, a custom element keeps its own, the
 * list of keys opens with `?` and from the menu, and a reader can turn the keys without a modifier off.
 *
 * @module
 */
import { expect, type Locator, type Page, test } from "@playwright/test";

/** A story with a theme switch's neighbours, for the keys that walk and cycle. */
const STORY = "/?story=kit:inputs-selection-select--overview";

/** The list of keys. */
const help = (page: Page): Locator => page.getByRole("dialog", { name: "Keyboard keys" });

/** A story's page, its frame drawn. */
const openStory = async (page: Page): Promise<void> => {
  await page.goto(STORY);
  await expect(page.frameLocator("iframe.forgebook-frame-view").locator("body")).toBeVisible();
  await expect(page.locator(".forgebook-frame-box[data-loading]")).toHaveCount(0);
};

test.describe("the shell's keys", () => {
  test("a story keeps every key pressed in its frame", async ({ page }) => {
    await openStory(page);
    const address = page.url();
    const frame = page.frameLocator("iframe.forgebook-frame-view");
    await frame.locator("body").click({ position: { x: 5, y: 5 } });
    for (const key of ["]", "[", "/", "?", "t", "c", "l", "d", "m"]) await page.keyboard.press(key);
    await page.waitForTimeout(200);
    expect(page.url()).toBe(address);
    await expect(help(page)).toHaveCount(0);
    await expect(page.getByRole("searchbox")).not.toBeFocused();
  });

  test("a custom element in the shell keeps its keys, in its shadow root too", async ({ page }) => {
    await openStory(page);
    const address = page.url();
    await page.evaluate(() => {
      const host = document.createElement("x-control");
      const input = document.createElement("div");
      input.tabIndex = 0;
      input.id = "inner";
      host.attachShadow({ mode: "open" }).append(input);
      document.body.append(host);
      input.focus();
    });
    for (const key of ["]", "/", "?", "t"]) await page.keyboard.press(key);
    await page.waitForTimeout(200);
    expect(page.url()).toBe(address);
    await expect(help(page)).toHaveCount(0);
    await expect(page.getByRole("searchbox")).not.toBeFocused();
  });

  test("? lists the keys, loaded only then", async ({ page }) => {
    const asked: string[] = [];
    page.on("request", (request) => asked.push(request.url()));
    await openStory(page);
    expect(asked.filter((url) => url.includes("/ShortcutHelp.tsx"))).toEqual([]);
    await page.locator("body").press("?");
    await expect(help(page)).toBeVisible();
    await expect(help(page).getByText("Next story")).toBeVisible();
    await expect(
      help(page)
        .getByText(/Next value of/)
        .first()
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help(page)).toHaveCount(0);
  });

  test("the menu at the sidebar's foot opens the list", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Interface:/ }).click();
    await page.getByRole("button", { name: "Keyboard keys" }).click();
    await expect(help(page)).toBeVisible();
  });

  test("turned off, the keys without a modifier do nothing, across a reload; the search's key stays", async ({
    page
  }) => {
    await openStory(page);
    await page.locator("body").press("?");
    await help(page)
      .getByRole("checkbox", { name: /Keys without a modifier/ })
      .uncheck();
    await help(page).getByRole("button", { name: "Close" }).click();
    await page.reload();
    await expect(page.locator(".forgebook-frame-box[data-loading]")).toHaveCount(0);
    const address = page.url();
    for (const key of ["]", "/", "?"]) await page.locator("body").press(key);
    await page.waitForTimeout(200);
    expect(page.url()).toBe(address);
    await expect(help(page)).toHaveCount(0);
    await expect(page.getByRole("searchbox")).not.toBeFocused();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("searchbox")).toBeFocused();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^Interface:/ }).click();
    await page.getByRole("button", { name: "Keyboard keys" }).click();
    await help(page)
      .getByRole("checkbox", { name: /Keys without a modifier/ })
      .check();
    await help(page).getByRole("button", { name: "Close" }).click();
    await page.locator("body").press("]");
    await expect.poll(() => page.url()).not.toBe(address);
  });
});
