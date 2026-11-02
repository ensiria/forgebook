/**
 * A Preact catalogue in the browser: its stories drawn by Preact itself, with no React and no `preact/compat` in their
 * frames, keeping their state through new args, through the same shell and frame as React's.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

import { PREACT_PORT } from "./ports";

test.use({ baseURL: `http://127.0.0.1:${PREACT_PORT}/` });

/** Every story of the fixture, by its id without the source. */
const STORY_IDS = [
  "inputs-badge--default",
  "inputs-badge--spread",
  "inputs-badge--removable",
  "inputs-counter--default",
  "inputs-counter--with-hook",
  "data-meter--half",
  "states-greeting--live",
  "states-fragile--default",
  "logic-use-toggle--default"
];

/** The address of a story. */
const story = (id: string, query = ""): string => `/?story=preact:${id}${query === "" ? "" : `&${query}`}`;

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/** Waits until the shown story's frame says it is ready. */
const isReady = async (page: Page): Promise<void> => {
  await expect(page.locator("iframe.forgebook-frame-view")).toBeVisible();
  await expect
    .poll(async () => frameOf(page).locator("html").getAttribute("data-forgebook-status"))
    .toBe("ready");
};

test("every Preact story is ready in its frame, without a page error, React or compat", async ({ page }) => {
  const errors: string[] = [];
  const scripts: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => scripts.push(response.url()));
  for (const id of STORY_IDS) {
    await page.goto(`/frame.html?story=preact:${id}`);
    await expect
      .poll(async () => page.locator("html").getAttribute("data-forgebook-status"), { message: id })
      .toBe("ready");
  }
  expect(errors).toEqual([]);
  // React's own modules, not Preact's, whose name holds the word
  expect(scripts.filter((url) => /(?<![a-z])react|compat|render-to-string/.test(url))).toEqual([]);
});

test.describe("what a story draws", () => {
  test("the preview's decorator is around every story, and a spread render draws the component", async ({
    page
  }) => {
    await page.goto("/frame.html?story=preact:inputs-badge--spread");
    await expect(page.getByTestId("preview")).toContainText("Status: New 3");
    await expect(page.locator(".badge--info")).toBeVisible();
  });

  test("a class component is drawn with its args, and a render's own hooks keep their state", async ({
    page
  }) => {
    await page.goto("/frame.html?story=preact:data-meter--half");
    await expect(page.locator("meter")).toHaveAttribute("aria-label", "Storage");
    await page.goto("/frame.html?story=preact:inputs-counter--with-hook");
    await page.getByRole("button", { name: "Hide" }).click();
    await expect(page.getByTestId("counter")).toHaveCount(0);
    await page.getByRole("button", { name: "Show" }).click();
    await expect(page.getByTestId("counter")).toHaveText("Clicks: 0");
  });

  test("a story's texts follow the language, and its clock is the story's", async ({ page }) => {
    await page.goto(story("states-greeting--live"));
    await isReady(page);
    await expect(frameOf(page).getByTestId("greeting")).toContainText("Hello 2030-01-01");
    await page.goto(story("states-greeting--live", "lang=it"));
    await isReady(page);
    await expect(frameOf(page).getByTestId("greeting")).toContainText("Ciao 2030-01-01");
  });
});

test.describe("the panel on a Preact component", () => {
  test("lists the props and events read from the component's types", async ({ page }) => {
    await page.goto(story("inputs-badge--default"));
    await isReady(page);
    await expect(page.getByLabel("label")).toHaveValue("New");
    await page.getByRole("tab", { name: "Events" }).click();
    await expect(page.getByText("onRemove")).toBeVisible();
    await expect(page.getByText("Called when the person takes the badge away.")).toBeVisible();
  });

  test("changes a prop in place, in a spread render too", async ({ page }) => {
    await page.goto(story("inputs-badge--spread"));
    await isReady(page);
    await page.getByLabel("label").fill("Changed");
    await expect(frameOf(page).getByTestId("badge")).toContainText("Changed");
  });

  test("new args draw the story again, keeping its state", async ({ page }) => {
    await page.goto(story("inputs-counter--default"));
    await isReady(page);
    await frameOf(page).getByTestId("counter").click();
    await frameOf(page).getByTestId("counter").click();
    await expect(frameOf(page).getByTestId("counter")).toHaveText("Clicks: 2");
    await page.getByLabel("label").fill("Taps");
    await expect(frameOf(page).getByTestId("counter")).toHaveText("Taps: 2");
  });

  test("records the event a person sends", async ({ page }) => {
    await page.goto(story("inputs-badge--removable", "tab=events"));
    await isReady(page);
    await frameOf(page).getByRole("button", { name: "Remove" }).click();
    await expect(page.locator(".forgebook-calls__item")).toContainText(["onRemove"]);
  });

  test("writes the story as JSX, with the values of the moment", async ({ page }) => {
    await page.goto(story("inputs-badge--default", "tab=code"));
    await isReady(page);
    await expect(page.getByRole("tabpanel")).toContainText('<Badge label="New" tone="info" count={3} />');
  });

  test("shows a story's error, and leaves it when the value changes back", async ({ page }) => {
    await page.goto(story("states-fragile--default"));
    await isReady(page);
    await page.getByLabel("text").fill("boom");
    await expect(frameOf(page).locator("body")).toContainText("Fragile broke");
    await page.getByLabel("text").fill("Fine again");
    await expect(frameOf(page).getByTestId("fragile")).toHaveText("Fine again");
    await expect(frameOf(page).locator("body")).not.toContainText("Fragile broke");
  });
});

test("a hook's story shows its signature first", async ({ page }) => {
  await page.goto(story("logic-use-toggle--default"));
  await isReady(page);
  await expect(page.getByRole("tab", { name: "Signature" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("readonly [boolean, () => void]").first()).toBeVisible();
});
