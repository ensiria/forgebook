/**
 * A catalogue of custom elements, in the browser: the Web Components fixture, whose Lit elements, plain element, slots,
 * templates, events and errors go through the same shell and frame as React's, documented by their Custom Elements
 * Manifest.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

import { catalogueUrl } from "./ports";

test.use({ baseURL: catalogueUrl("web-components") });

/** Every story of the fixture, by its id without the source. */
const STORY_IDS = [
  "inputs-badge--default",
  "inputs-badge--with-slots",
  "inputs-badge--from-template",
  "inputs-badge--from-markup",
  "inputs-badge--removable",
  "inputs-counter--default",
  "states-fragile--default",
  "states-greeting--live",
  "logic-format-count--default"
];

/** The address of a story. */
const story = (id: string, query = ""): string => `/?story=wc:${id}${query === "" ? "" : `&${query}`}`;

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/** Waits until the shown story's frame says it is ready. */
const isReady = async (page: Page): Promise<void> => {
  await expect(page.locator("iframe.forgebook-frame-view")).toBeVisible();
  await expect
    .poll(async () => frameOf(page).locator("html").getAttribute("data-forgebook-status"))
    .toBe("ready");
};

test("every Web Components story is ready in its frame, without a page error, React or the server renderer", async ({
  page
}) => {
  const errors: string[] = [];
  const scripts: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => scripts.push(response.url()));
  for (const id of STORY_IDS) {
    await page.goto(`/frame.html?story=wc:${id}`);
    await expect
      .poll(async () => page.locator("html").getAttribute("data-forgebook-status"), { message: id })
      .toBe("ready");
  }
  expect(errors).toEqual([]);
  expect(scripts.filter((url) => /react|lit-labs|serverRender/.test(url))).toEqual([]);
});

test.describe("what a story draws", () => {
  test("a template, HTML and the element from its args all draw the element", async ({ page }) => {
    await page.goto("/frame.html?story=wc:inputs-badge--from-template");
    await expect(page.getByTestId("template").locator(".badge")).toHaveText("New");
    await page.goto("/frame.html?story=wc:inputs-badge--from-markup");
    await expect(page.locator("fixture-panel h2")).toHaveText("Panel");
    await expect(page.locator("fixture-panel .badge")).toHaveText("Inside");
    await page.goto("/frame.html?story=wc:inputs-badge--with-slots");
    await expect(page.locator("fixture-badge")).toContainText("from the slot");
    await expect(page.locator('fixture-badge span[slot="icon"]')).toHaveText("*");
  });

  test("the preview's decorator is around every story", async ({ page }) => {
    await page.goto("/frame.html?story=wc:inputs-badge--default");
    await expect(page.getByTestId("preview").locator("fixture-badge")).toHaveAttribute("label", "New");
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

test.describe("the panel on a custom element", () => {
  test("lists the attributes, properties, slots and events its manifest describes", async ({ page }) => {
    await page.goto(story("inputs-badge--default"));
    await isReady(page);
    await expect(page.getByLabel("label", { exact: true })).toHaveValue("New");
    await expect(page.getByLabel("item-count")).toHaveValue("3");
    await expect(page.getByLabel("#default")).toBeVisible();
    await page.getByRole("tab", { name: "Events" }).click();
    await expect(page.getByText("@remove")).toBeVisible();
    await expect(page.getByText("The person took it away.")).toBeVisible();
  });

  test("changes an attribute, a choice the manifest only names, and a slot from its text", async ({
    page
  }) => {
    await page.goto(story("inputs-badge--default"));
    await isReady(page);
    await page.getByLabel("label", { exact: true }).fill("Changed");
    await expect(frameOf(page).locator(".badge")).toHaveText("Changed");
    await page
      .getByRole("group", { name: "tone" })
      .getByRole("radio", { name: "danger" })
      .check({ force: true });
    await expect(frameOf(page).locator("fixture-badge")).toHaveAttribute("tone", "danger");
    await page.getByLabel("#default").fill("in the slot");
    await expect(frameOf(page).locator("fixture-badge")).toContainText("in the slot");
  });

  test("new args keep the element's own state", async ({ page }) => {
    await page.goto(story("inputs-counter--default"));
    await isReady(page);
    await frameOf(page).getByTestId("counter").click();
    await expect(frameOf(page).getByTestId("counter")).toHaveText("Clicks: 1");
    await page.getByLabel("label", { exact: true }).fill("Taps");
    await expect(frameOf(page).getByTestId("counter")).toHaveText("Taps: 1");
  });

  test("records the event an element dispatches", async ({ page }) => {
    await page.goto(story("inputs-badge--default", "tab=events"));
    await isReady(page);
    // the shell names the events to record once the docs are read: listed, they reach the frame
    await expect(page.getByRole("tabpanel").getByText("@remove")).toBeVisible();
    await frameOf(page).getByRole("button", { name: "Remove" }).click();
    await expect(page.locator(".forgebook-calls__item")).toContainText(["@remove"]);
  });

  test("writes the story as HTML, with the values of the moment", async ({ page }) => {
    await page.goto(story("inputs-badge--default", "tab=code"));
    await isReady(page);
    await expect(page.getByRole("tabpanel")).toContainText(
      '<fixture-badge label="New" tone="info" item-count="3"></fixture-badge>'
    );
    await page.goto(story("inputs-badge--with-slots", "tab=code"));
    await expect(page.getByRole("tabpanel")).toContainText('<span slot="icon">*</span>');
  });

  test("shows an element's error, and leaves it when the value changes back", async ({ page }) => {
    await page.goto(story("states-fragile--default"));
    await isReady(page);
    await page.getByLabel("text", { exact: true }).fill("boom");
    await expect(frameOf(page).locator("body")).toContainText("Fragile broke");
    await page.getByLabel("text", { exact: true }).fill("Fine again");
    await expect(frameOf(page).getByTestId("fragile")).toHaveText("Fine again");
    await expect(frameOf(page).locator("body")).not.toContainText("Fragile broke");
  });
});

test("a function's story shows its signature first", async ({ page }) => {
  await page.goto(story("logic-format-count--default"));
  await isReady(page);
  await expect(page.getByRole("tab", { name: "Signature" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("count: number").first()).toBeVisible();
});
