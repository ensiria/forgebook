/**
 * A switch offered as a gallery, on a catalogue with several visual themes (`themes/forgebook.config.ts`): what loads and
 * when, the keys and names, a value that implies another switch, a value's own style sheet, and the page colour that
 * follows a switch.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

import { catalogueUrl } from "./ports";

/** The catalogue's address. */
const THEMES = catalogueUrl("themes");

/** How long a page waits on a cold dev server. */
const SLOW_ANSWER = { timeout: 30_000 };

/** The address of a story, in a view. */
const storyIn = (query = ""): string =>
  `${THEMES}?story=kit:inputs-selection-select--overview${query === "" ? "" : `&${query}`}`;

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view").first();

/** Opens a story, and waits until its frame says it is ready. */
const openStory = async (page: Page, query = ""): Promise<void> => {
  await page.goto(storyIn(query));
  await expect(frameOf(page).locator("html")).toHaveAttribute("data-forgebook-status", "ready", SLOW_ANSWER);
};

/** The gallery's menu. */
const menuOf = (page: Page) => page.getByRole("dialog", { name: "Theme" });

/** An item of the open menu: the press a reader's pointer lands on. */
const itemOf = (page: Page, name: string) => menuOf(page).locator("label").filter({ hasText: name });

test.describe("a gallery", () => {
  test("loads its menu, its previews and its pictures only when it opens", async ({ page }) => {
    const asked: string[] = [];
    page.on("request", (request) => asked.push(request.url()));
    await openStory(page);
    const ofGallery = (): string[] =>
      asked.filter((url) => /SwitchGalleryPanel|switch-previews|paper\.png|meadow\.svg/.test(url));
    expect(ofGallery()).toEqual([]);

    await page.getByRole("button", { name: "Theme: Plain" }).click();
    await expect(menuOf(page)).toBeVisible();
    await expect(itemOf(page, "Paper").locator("img")).toHaveJSProperty("complete", true);
    await expect.poll(() => ofGallery().some((url) => url.includes("paper.png"))).toBe(true);
    // nothing from an address, whatever the catalogue's previews name
    const origins = new Set(asked.map((url) => new URL(url).hostname));
    expect([...origins]).toEqual(["127.0.0.1"]);
  });

  test("shows a picture, swatches with a font's name, and a value with no preview by its name", async ({
    page
  }) => {
    await openStory(page);
    await page.getByRole("button", { name: "Theme: Plain" }).click();
    await expect(itemOf(page, "Paper").locator("img")).toBeVisible();
    await expect(itemOf(page, "Night").locator(".forgebook-gallery__swatches span")).toHaveCount(4);
    await expect(itemOf(page, "Night")).toContainText("Harbor Sans");
    // the font's name is drawn in that font where the reader has it
    await expect(itemOf(page, "Night").locator(".forgebook-gallery__font")).toHaveCSS(
      "font-family",
      /^"Harbor Sans", /
    );
    await expect(itemOf(page, "Harbour at first light").locator(".forgebook-gallery__letter")).toHaveText(
      "H"
    );
  });

  test("is named by its values' labels, never by a picture", async ({ page }) => {
    await openStory(page);
    await page.getByRole("button", { name: "Theme: Plain" }).click();
    for (const name of ["Plain", "Paper", "Night", "Meadow", "Harbour at first light"])
      await expect(menuOf(page).getByRole("radio", { name, exact: true })).toHaveCount(1);
    await expect(menuOf(page).getByRole("radio")).toHaveCount(5);
    await expect(itemOf(page, "Paper").locator("img")).toHaveAttribute("alt", "");
  });

  test("is one tab stop, chosen with the arrows, closed by Escape with the focus back on its button", async ({
    page
  }) => {
    await openStory(page);
    const button = page.getByRole("button", { name: "Theme: Plain" });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(menuOf(page).getByRole("radio", { checked: true })).toBeFocused();
    await expect(menuOf(page).getByRole("radio", { name: "Plain" })).toBeChecked();

    await page.keyboard.press("ArrowDown");
    await expect(menuOf(page).getByRole("radio", { name: "Paper" })).toBeFocused();
    await expect(page).toHaveURL(/look=paper/);
    // the keys keep it open, so the next value stays in reach
    await expect(menuOf(page)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menuOf(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Theme: Paper" })).toBeFocused();
  });

  test("closes on a press, on the value shown too", async ({ page }) => {
    await openStory(page);
    await page.getByRole("button", { name: "Theme: Plain" }).click();
    await itemOf(page, "Meadow").click();
    await expect(menuOf(page)).toHaveCount(0);
    await expect(page).toHaveURL(/look=meadow/);
    await page.getByRole("button", { name: "Theme: Meadow" }).click();
    await itemOf(page, "Meadow").click();
    await expect(menuOf(page)).toHaveCount(0);
  });

  test("opened in the View menu, is whole in the window, and Escape closes only it", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 700 });
    await openStory(page);
    await page.getByRole("button", { name: /^View/ }).click();
    const view = page.getByRole("dialog", { name: "View" });
    await view.getByRole("button", { name: "Theme: Plain" }).click();
    await expect(menuOf(page)).toBeVisible();
    await menuOf(page).evaluate((panel) => Promise.all(panel.getAnimations().map((each) => each.finished)));
    await expect(menuOf(page)).toBeInViewport({ ratio: 1 });
    // with the focus outside its values too
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.keyboard.press("Escape");
    await expect(menuOf(page)).toHaveCount(0);
    await expect(view).toBeVisible();
  });
});

test.describe("a value that implies another switch", () => {
  const appearance = (page: Page) => page.getByRole("group", { name: "Appearance" });

  test("draws the implied value with the control off, and leaves the reader's own in the address", async ({
    page
  }) => {
    await openStory(page);
    await page.getByRole("button", { name: "Theme: Plain" }).click();
    await itemOf(page, "Night").click();
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(appearance(page).getByRole("radio", { name: "Light" })).toBeDisabled();
    await expect(appearance(page)).toHaveAttribute("title", "Set by Night");
    await expect(appearance(page).getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(new URL(page.url()).searchParams.get("theme")).toBeNull();

    await page.getByRole("button", { name: "Theme: Night" }).click();
    await itemOf(page, "Plain").click();
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-theme", "light");
    await expect(appearance(page).getByRole("radio", { name: "Light" })).toBeEnabled();
  });

  test("wins over the address, and in a frame opened by itself", async ({ page }) => {
    await openStory(page, "look=night&theme=light");
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-theme", "dark");
    await page.goto(`${THEMES}frame.html?story=kit:inputs-selection-select--overview&look=night&theme=light`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", SLOW_ANSWER);
  });

  test("leaves out of Compare the cells it contradicts, and cannot be compared while implied", async ({
    page
  }) => {
    await openStory(page, "compare=look,theme");
    const labels = page.locator(".forgebook-compare__label");
    await expect(labels.filter({ hasText: /^Night$/ })).toHaveCount(0);
    await expect(labels.filter({ hasText: /^Night · Dark$/ })).toHaveCount(1);
    await expect(labels.filter({ hasText: /^Plain$/ })).toHaveCount(1);

    await openStory(page, "look=night");
    await page.getByRole("button", { name: "Compare" }).click();
    await expect(
      page.getByRole("dialog", { name: "Compare" }).getByRole("radio", { name: /^Appearance/ })
    ).toBeDisabled();
  });

  test("is told to the story's box: it waits on the value's colour", async ({ page }) => {
    await openStory(page, "look=night");
    await expect(page.locator("[style*='background-color']").first()).toHaveCSS(
      "background-color",
      "rgb(11, 16, 32)"
    );
  });
});

test.describe("a value's own style sheet", () => {
  test("loads only for that value, swapped without a moment with neither", async ({ page }) => {
    await openStory(page);
    expect(await frameOf(page).locator('link[href*="paper"], link[href*="night"]').count()).toBe(0);

    await page.getByRole("button", { name: "Theme: Plain" }).click();
    await itemOf(page, "Paper").click();
    await expect(frameOf(page).locator('link[href*="paper"]')).toHaveCount(1);
    const custom = (name: string) =>
      frameOf(page)
        .locator("html")
        .evaluate((root, property) => getComputedStyle(root).getPropertyValue(property), name);
    await expect.poll(() => custom("--fixture-look")).toBe("paper");

    // the next sheet is held back: the old one stays, and the root keeps the old value, until it arrives
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.context().route(/night\.css(?!\?url)/, async (route) => {
      await held;
      await route.continue();
    });
    await page.getByRole("button", { name: "Theme: Paper" }).click();
    await itemOf(page, "Night").click();
    await expect(frameOf(page).locator('link[href*="night"]')).toHaveCount(1);
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-look", "paper");
    expect(await custom("--fixture-look")).toBe("paper");

    release();
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-look", "night");
    await expect.poll(() => custom("--fixture-look")).toBe("night");
    await expect(frameOf(page).locator('link[href*="paper"]')).toHaveCount(0);
    expect(await custom("--fixture-look-paper")).toBe("");
  });

  test("going back before a sheet has loaded stays where the reader went", async ({ page }) => {
    await openStory(page);
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.context().route(/night\.css(?!\?url)/, async (route) => {
      await held;
      await route.continue();
    });
    await page.getByRole("button", { name: "Theme: Plain" }).click();
    await itemOf(page, "Night").click();
    await expect(frameOf(page).locator('link[href*="night"]')).toHaveCount(1);
    await page.getByRole("button", { name: "Theme: Night" }).click();
    await itemOf(page, "Plain").click();
    await expect(page).not.toHaveURL(/look=/);
    release();
    await expect(frameOf(page).locator('link[href*="night"]')).toHaveCount(0);
    await expect(frameOf(page).locator("html")).not.toHaveAttribute("data-look", /.*/);
  });

  test("that does not load leaves the story drawn, and choosing the value again tries again", async ({
    page
  }) => {
    let isDown = true;
    await page
      .context()
      .route(/night\.css(?!\?url)/, (route) => (isDown ? route.fulfill({ status: 500 }) : route.continue()));
    await openStory(page, "look=night");
    await expect(frameOf(page).locator("select").first()).toBeVisible();
    await expect(frameOf(page).locator('link[href*="night"]')).toHaveCount(0);

    isDown = false;
    await page.getByRole("button", { name: "Theme: Night" }).click();
    await itemOf(page, "Plain").click();
    await page.getByRole("button", { name: "Theme: Plain" }).click();
    await itemOf(page, "Night").click();
    await expect(frameOf(page).locator('link[href*="night"]')).toHaveCount(1);
  });

  test("is left out by Styles › Structure, as a theme is", async ({ page }) => {
    await openStory(page, "look=paper&sheets=structure");
    expect(await frameOf(page).locator('link[href*="paper"]').count()).toBe(0);
  });
});

test.describe("the catalogue's own appearance menu", () => {
  test("is not named as a catalogue's switch relabelled Appearance", async ({ page }) => {
    await openStory(page);
    await expect(page.getByRole("button", { name: "Interface: System" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Appearance" })).toBeVisible();
  });
});
