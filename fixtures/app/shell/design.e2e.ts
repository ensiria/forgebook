/**
 * The Design tab in the browser, with Figma's embed answered by a stand-in, so the suite needs no network: nothing of it
 * loads until it is opened, it frames Figma's address, and the comparison shows the story beside the design.
 *
 * @module
 */
import { expect, type FrameLocator, type Locator, type Page, test } from "@playwright/test";

/** A story whose meta names a design. */
const FORM = "/?story=kit:layouts-form--signup";

/** A story with a design of its own, and props to set. */
const SMALL = "/?story=kit:inputs-selection-select--small";

/** The stand-in's text. */
const STAND_IN = "The design, from Figma";

/**
 * Answers Figma's embed host with a stand-in.
 *
 * @param page - the page.
 * @returns the addresses asked for.
 */
const standInForFigma = async (page: Page): Promise<string[]> => {
  const asked: string[] = [];
  await page.route("https://embed.figma.com/**", async (route) => {
    asked.push(route.request().url());
    await route.fulfill({ contentType: "text/html", body: `<p>${STAND_IN}</p>` });
  });
  return asked;
};

/** The story's frame in the comparison. */
const comparedStory = (page: Page): FrameLocator =>
  page.getByRole("dialog").frameLocator("iframe[src*='frame.html']");

/**
 * Has a story's frame post a report to the shell, as its own code does.
 *
 * @param iframe - the frame's element.
 * @param report - the message.
 */
const reportFrom = async (iframe: Locator, report: unknown): Promise<void> => {
  const frame = await (await iframe.elementHandle())?.contentFrame();
  await frame?.evaluate((message) => window.parent.postMessage(message, window.location.origin), report);
};

test.describe("the Design tab", () => {
  test("costs nothing until opened: neither its code, nor its styles, nor Figma", async ({ page }) => {
    const asked = await standInForFigma(page);
    const modules: string[] = [];
    page.on("request", (request) => modules.push(request.url()));
    await page.goto(FORM);
    const tab = page.getByRole("tab", { name: "Design" });
    await expect(tab).toBeVisible();
    await expect(page.locator("iframe.forgebook-frame-view")).toBeVisible();
    expect(modules.filter((url) => /DesignTab\.tsx|designTab\.css/.test(url))).toEqual([]);
    expect(asked).toEqual([]);

    await tab.click();
    await expect(page.frameLocator("iframe[title^='Design of']").getByText(STAND_IN)).toBeVisible();
    expect(modules.some((url) => url.includes("DesignTab.tsx"))).toBe(true);
    expect(asked).toHaveLength(1);
    const embed = new URL(asked[0] ?? "");
    expect(embed.pathname).toBe("/design/FixtureFile123");
    expect(embed.searchParams.get("node-id")).toBe("12:34");
    expect(embed.searchParams.get("embed-host")).toBe("forgebook");
  });

  test("opens on its own from the address, for a link an agent hands a person", async ({ page }) => {
    await standInForFigma(page);
    await page.goto(`${FORM}&tab=design`);
    await expect(page.getByRole("tab", { name: "Design" })).toHaveAttribute("aria-selected", "true");
    await expect(page.frameLocator("iframe[title^='Design of']").getByText(STAND_IN)).toBeVisible();
  });

  test("is offered only to a story with a design", async ({ page }) => {
    await page.goto("/?story=kit:inputs-selection-select--overview");
    await expect(page.getByRole("tab", { name: "Props" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Design" })).toHaveCount(0);
  });

  test("links the component to its design, from the header and the panel", async ({ page }) => {
    await standInForFigma(page);
    await page.goto(`${FORM}&tab=design`);
    const links = page.getByRole("link", { name: "Open in Figma" });
    await expect(links).toHaveCount(2);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute("href", "https://www.figma.com/design/FixtureFile123?node-id=12-34");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  test("takes the story's own design over the meta's", async ({ page }) => {
    const asked = await standInForFigma(page);
    await page.goto(`${SMALL}&tab=design`);
    await expect(page.frameLocator("iframe[title^='Design of']").getByText(STAND_IN)).toBeVisible();
    expect(new URL(asked[0] ?? "").searchParams.get("node-id")).toBe("56:78");
  });

  test("compares the story, with the panel's values, and its design side by side", async ({ page }) => {
    await standInForFigma(page);
    await page.goto(`${SMALL}&args=${encodeURIComponent(JSON.stringify({ value: "monthly" }))}`);
    await page.getByRole("tab", { name: "Design" }).click();
    await page.getByRole("button", { name: "Compare with the story" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.frameLocator("iframe[title^='Design of']").getByText(STAND_IN)).toBeVisible();
    await expect(comparedStory(page).locator("select")).toHaveValue("monthly");

    const story = await dialog.getByText("Story", { exact: true }).boundingBox();
    const design = await dialog.getByText("Design", { exact: true }).boundingBox();
    expect(story?.y).toBe(design?.y);
    expect(story?.x ?? 0).toBeLessThan(design?.x ?? 0);
  });

  test("keeps the compared frame's reports from the stage, which runs the story at another size", async ({
    page
  }) => {
    await standInForFigma(page);
    await page.goto(`${SMALL}&tab=design`);
    await page.getByRole("button", { name: "Compare with the story" }).click();
    await expect(comparedStory(page).locator("select")).toBeVisible();
    const report = {
      type: "forgebook:play",
      storyId: "kit:inputs-selection-select--small",
      trace: { status: "running", steps: [] }
    };
    await reportFrom(page.getByRole("dialog").locator("iframe[src*='frame.html']"), report);
    await page.getByRole("button", { name: "Close the comparison" }).click();
    await expect(page.getByRole("tab", { name: "Interactions" })).toHaveCount(0);

    // the same report from the stage's own frame does reach it: the check above can fail
    await reportFrom(page.locator("iframe.forgebook-frame-view"), report);
    await expect(page.getByRole("tab", { name: "Interactions" })).toBeVisible();
  });

  test("follows the story when the history changes it under the comparison", async ({ page }) => {
    const asked = await standInForFigma(page);
    await page.goto(`${FORM}&tab=design`);
    await page.getByRole("button", { name: "Compare with the story" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.evaluate(() => {
      const address = new URL(window.location.href);
      address.searchParams.set("story", "kit:inputs-selection-select--small");
      window.history.pushState(null, "", address);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect.poll(() => asked.at(-1)).toContain("node-id=56%3A78");
  });

  test("closes the comparison with Escape, gives the focus back, and keeps the shell's keys off", async ({
    page
  }) => {
    await standInForFigma(page);
    await page.goto(`${FORM}&tab=design`);
    const compare = page.getByRole("button", { name: "Compare with the story" });
    await compare.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Close the comparison" }).focus();
    await page.keyboard.press("]");
    await expect(page).toHaveURL(/layouts-form--signup/);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(compare).toBeFocused();
    await expect(page.frameLocator("iframe[title^='Design of']").getByText(STAND_IN)).toBeVisible();
  });

  test("stacks the two on a phone's width", async ({ page }) => {
    await standInForFigma(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${FORM}&tab=design`);
    await page.getByRole("button", { name: "Compare with the story" }).click();
    const dialog = page.getByRole("dialog");
    const story = await dialog.getByText("Story", { exact: true }).boundingBox();
    const design = await dialog.getByText("Design", { exact: true }).boundingBox();
    expect(story?.x).toBe(design?.x);
    expect(story?.y ?? 0).toBeLessThan(design?.y ?? 0);
  });
});
