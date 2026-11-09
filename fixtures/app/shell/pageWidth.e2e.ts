/**
 * The page width's button in the browser: the home and a component's page in a centred column by default, or the whole
 * width, kept after a reload; a docs page and a story's stage left as they are; the header's controls in the same place
 * on a component's page and on its stories' pages.
 *
 * @module
 */
import { expect, type Locator, type Page, test } from "@playwright/test";

import { catalogueUrl } from "./ports";

/** The fixture's Select: a component with several stories. */
const COMPONENT = "/?component=kit:inputs-selection-select";

/** One of its stories. */
const STORY = "/?story=kit:inputs-selection-select--overview";

/** The button, by its name. */
const toggleOf = (page: Page): Locator => page.getByRole("button", { name: "Contained width" });

/** An element's width, in CSS px. */
const widthOf = async (element: Locator): Promise<number> =>
  (await element.boundingBox().then((box) => box?.width)) ?? 0;

/** Waits until the column stopped changing width, the animation over. */
const settledWidth = async (column: Locator): Promise<number> => {
  let last = -1;
  await expect
    .poll(async () => {
      const now = await widthOf(column);
      const isSettled = now === last;
      last = now;
      return isSettled;
    })
    .toBe(true);
  return last;
};

test.describe("the page width", () => {
  test("a component's page: contained by default, the whole width when off, kept after a reload", async ({
    page
  }) => {
    await page.goto(COMPONENT);
    const column = page.locator(".forgebook-doc");
    const scroll = page.locator(".forgebook-scroll");
    const toggle = toggleOf(page);
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    const contained = await settledWidth(column);
    expect(contained).toBeLessThan((await widthOf(scroll)) - 100);
    const before = await toggle.boundingBox();
    const select = await page.getByLabel("Stories", { exact: true }).boundingBox();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(await settledWidth(column)).toBeGreaterThan(contained + 100);
    // the header does not move: only the column below it widens
    expect(await toggle.boundingBox()).toEqual(before);
    expect(await page.getByLabel("Stories", { exact: true }).boundingBox()).toEqual(select);

    await page.reload();
    await expect(toggleOf(page)).toHaveAttribute("aria-pressed", "false");
    expect(await settledWidth(page.locator(".forgebook-doc"))).toBeGreaterThan(contained + 100);
  });

  test("works from the keyboard", async ({ page }) => {
    await page.goto(COMPONENT);
    const toggle = toggleOf(page);
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  test("a story's page keeps the button's place, empty, so the picker stays put", async ({ page }) => {
    await page.goto(COMPONENT);
    await expect(toggleOf(page)).toBeVisible();
    const picker = page.getByLabel("Stories", { exact: true });
    const select = await picker.boundingBox();
    await picker.selectOption({ label: "Overview" });
    await expect(page).toHaveURL(/story=kit%3Ainputs-selection-select--overview/);
    // the place is there, with no button: no Tab stop, nothing a screen reader names
    await expect(page.locator(".forgebook-page-width")).toHaveCount(1);
    await expect(toggleOf(page)).toHaveCount(0);
    expect(await picker.boundingBox()).toEqual(select);
    // and opened by its address, the same
    await page.goto(STORY);
    await expect(page.locator(".forgebook-page-width")).toHaveCount(1);
    expect(await picker.boundingBox()).toEqual(select);
  });

  test("a docs page keeps its reading column", async ({ page }) => {
    await page.goto("/?page=kit:blocks");
    const body = page.locator(".forgebook-docs__body");
    const contained = await settledWidth(body);
    await page.goto(COMPONENT);
    await toggleOf(page).click();
    await page.goto("/?page=kit:blocks");
    expect(await settledWidth(page.locator(".forgebook-docs__body"))).toBe(contained);
  });

  test("animates the change, and not for a reader who asks for less motion", async ({ page }) => {
    await page.goto(COMPONENT);
    const column = page.locator(".forgebook-doc");
    await expect(column).not.toHaveCSS("transition-duration", "0s");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(column).toHaveCSS("transition-duration", "0s");
  });

  for (const [name, address] of [
    ["the written home", "/"],
    ["the generated home", catalogueUrl("generated-home")]
  ] as const) {
    test(`${name}: the same button, kept after a reload`, async ({ page }) => {
      await page.goto(address);
      const column = page.locator(".forgebook-home");
      const toggle = toggleOf(page);
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      const contained = await settledWidth(column);
      const before = await toggle.boundingBox();
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      expect(await settledWidth(column)).toBeGreaterThan(contained + 100);
      expect(await toggle.boundingBox()).toEqual(before);
      await page.reload();
      await expect(toggleOf(page)).toHaveAttribute("aria-pressed", "false");
    });
  }
});
