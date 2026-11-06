/**
 * A Solid catalogue in the browser: its stories run once, take new args in place, wait for their resources and show
 * their errors, through the same shell and frame as React's.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

import { catalogueUrl } from "./ports";

test.use({ baseURL: catalogueUrl("solid") });

/** Every story of the fixture, by its id without the source. */
const STORY_IDS = [
  "inputs-badge--default",
  "inputs-badge--spread",
  "inputs-badge--removable",
  "inputs-counter--default",
  "states-greeting--live",
  "states-fragile--default",
  "states-loaded--default",
  "logic-create-toggle--default"
];

/** The address of a story. */
const story = (id: string, query = ""): string => `/?story=solid:${id}${query === "" ? "" : `&${query}`}`;

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/** Waits until the shown story's frame says it is ready. */
const isReady = async (page: Page): Promise<void> => {
  await expect(page.locator("iframe.forgebook-frame-view")).toBeVisible();
  await expect
    .poll(async () => frameOf(page).locator("html").getAttribute("data-forgebook-status"))
    .toBe("ready");
};

test("every Solid story is ready in its frame, without a page error and without React", async ({ page }) => {
  const errors: string[] = [];
  const scripts: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => scripts.push(response.url()));
  for (const id of STORY_IDS) {
    await page.goto(`/frame.html?story=solid:${id}`);
    await expect
      .poll(async () => page.locator("html").getAttribute("data-forgebook-status"), { message: id })
      .toBe("ready");
  }
  expect(errors).toEqual([]);
  expect(scripts.filter((url) => /react/.test(url))).toEqual([]);
});

test.describe("what a story draws", () => {
  test("the preview's decorator is around every story, and a spread render draws the component", async ({
    page
  }) => {
    await page.goto("/frame.html?story=solid:inputs-badge--spread");
    await expect(page.getByTestId("preview")).toContainText("Status: New 3");
    await expect(page.locator(".badge--info")).toBeVisible();
  });

  test("a story that reads a resource is drawn once it has loaded, and its play finds it", async ({
    page
  }) => {
    await page.goto(story("states-loaded--default"));
    await isReady(page);
    await expect(frameOf(page).getByTestId("loaded")).toHaveText("Loaded");
    await expect(page.getByRole("tab", { name: /Interactions/ })).toContainText("passed");
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

test.describe("the panel on a Solid component", () => {
  test("lists the props and events read from the component's types", async ({ page }) => {
    await page.goto(story("inputs-badge--default"));
    await isReady(page);
    await expect(page.getByLabel("label", { exact: true })).toHaveValue("New");
    await page.getByRole("tab", { name: "Events" }).click();
    await expect(page.getByText("onRemove")).toBeVisible();
    await expect(page.getByText("Called when the person takes the badge away.")).toBeVisible();
  });

  test("changes a prop in place, in a spread render too", async ({ page }) => {
    await page.goto(story("inputs-badge--spread"));
    await isReady(page);
    await page.getByLabel("label", { exact: true }).fill("Changed");
    await expect(frameOf(page).getByTestId("badge")).toContainText("Changed");
  });

  test("new args reach a story that runs once, and its count stays", async ({ page }) => {
    await page.goto(story("inputs-counter--default"));
    await isReady(page);
    await frameOf(page).getByTestId("counter").click();
    await frameOf(page).getByTestId("counter").click();
    await expect(frameOf(page).getByTestId("counter")).toHaveText("Clicks: 2");
    await page.getByLabel("label", { exact: true }).fill("Taps");
    await expect(frameOf(page).getByTestId("counter")).toHaveText("Taps: 2");
  });

  test("records the event a person sends", async ({ page }) => {
    await page.goto(story("inputs-badge--removable", "tab=events"));
    await isReady(page);
    // the frame records the events the component's docs name: they may arrive after the story on a first read
    await expect(page.getByRole("tabpanel")).toContainText("onRemove");
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
    await page.getByLabel("text", { exact: true }).fill("boom");
    await expect(frameOf(page).locator("body")).toContainText("Fragile broke");
    await page.getByLabel("text", { exact: true }).fill("Fine again");
    await expect(frameOf(page).getByTestId("fragile")).toHaveText("Fine again");
    await expect(frameOf(page).locator("body")).not.toContainText("Fragile broke");
  });
});

test("a primitive's story shows its signature first", async ({ page }) => {
  await page.goto(story("logic-create-toggle--default"));
  await isReady(page);
  await expect(page.getByRole("tab", { name: "Signature" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Accessor<boolean>").first()).toBeVisible();
});
