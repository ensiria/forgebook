/**
 * The play switch in the browser: a story with a play runs it unless the address or the reader says otherwise, "Run"
 * plays it once, and the reader's choice is remembered. A frame with no word plays: `storyRun.test.ts`, and every
 * generated test.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

/** A story of the kit with a play, that names its steps. */
const STORY = "kit:inputs-selection-select--played";

/** The address of its page. */
const address = (query = ""): string => `/?story=${STORY}&tab=play${query}`;

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

test.describe("the play switch", () => {
  test("off in the address, a play waits; Run plays it once, and the address stays", async ({ page }) => {
    const tab = page.getByRole("tab", { name: /Interactions/ });
    await page.goto(address("&play=off"));
    await expect(tab).toContainText("not run");
    await expect(page.locator(".forgebook-play__label")).toHaveCount(0);
    await expect(frameOf(page).locator("body")).toBeVisible();
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(tab).toContainText("passed");
    await expect(page.locator(".forgebook-play__label")).toHaveText(["find the select", "read its value"]);
    await expect(page).toHaveURL(/play=off/);
  });

  test("the frame hears off from the address", async ({ page }) => {
    await page.goto(address("&play=off"));
    await expect(page.locator("iframe.forgebook-frame-view")).toHaveAttribute("src", /[?&]play=off/);
  });

  test("the reader's choice is remembered, and an address still comes first", async ({ page }) => {
    const tab = page.getByRole("tab", { name: /Interactions/ });
    await page.goto(address());
    await expect(tab).toContainText("passed");
    await page.getByRole("checkbox", { name: "Play stories when they open" }).uncheck();
    await expect(tab).toContainText("not run");
    await page.goto(address());
    await expect(tab).toContainText("not run");
    await page.goto(address("&play=on"));
    await expect(tab).toContainText("passed");
  });

  test("the View menu holds the same switch", async ({ page }) => {
    await page.goto(address());
    await page.getByRole("button", { name: "View", exact: false }).first().click();
    await page.getByRole("switch", { name: "Play stories when they open" }).uncheck();
    await expect(page.getByRole("tab", { name: /Interactions/ })).toContainText("not run");
  });
});
