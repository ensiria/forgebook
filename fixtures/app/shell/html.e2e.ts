/**
 * A catalogue with no framework, in the browser: the plain HTML fixture, whose stories return HTML strings and DOM
 * nodes, in TypeScript and in JavaScript, and go through the same shell and frame as React's.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

import { catalogueUrl } from "./ports";

test.use({ baseURL: catalogueUrl("html") });

/** Every story of the fixture, by its id without the source. */
const STORY_IDS = [
  "inputs-button--default",
  "inputs-button--from-markup",
  "inputs-button--pressed",
  "inputs-field--default",
  "inputs-counter--default",
  "states-fragile--default",
  "states-greeting--live",
  "cards-tile--default",
  "logic-format-count--default"
];

/** The address of a story. */
const story = (id: string, query = ""): string => `/?story=html:${id}${query === "" ? "" : `&${query}`}`;

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/** Waits until the shown story's frame says it is ready. */
const isReady = async (page: Page): Promise<void> => {
  await expect(page.locator("iframe.forgebook-frame-view")).toBeVisible();
  await expect
    .poll(async () => frameOf(page).locator("html").getAttribute("data-forgebook-status"))
    .toBe("ready");
};

test("every HTML story is ready in its frame, without a page error and without React", async ({ page }) => {
  const errors: string[] = [];
  const scripts: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => scripts.push(response.url()));
  for (const id of STORY_IDS) {
    await page.goto(`/frame.html?story=html:${id}`);
    await expect
      .poll(async () => page.locator("html").getAttribute("data-forgebook-status"), { message: id })
      .toBe("ready");
  }
  expect(errors).toEqual([]);
  expect(scripts.filter((url) => /react/.test(url))).toEqual([]);
});

test.describe("what a story draws", () => {
  test("the meta's function draws a node, a render HTML, inside the preview's decorator", async ({
    page
  }) => {
    await page.goto("/frame.html?story=html:inputs-button--default");
    await expect(page.getByTestId("preview").getByTestId("button")).toHaveText("Save");
    await expect(page.getByTestId("button")).toHaveClass("button button--info");
    await page.goto("/frame.html?story=html:inputs-button--from-markup");
    await expect(page.getByTestId("toolbar").getByRole("button")).toHaveText("Save");
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

test.describe("the panel on an HTML story", () => {
  test("lists the function's args from its types and TSDoc, its events apart", async ({ page }) => {
    await page.goto(story("inputs-button--default"));
    await isReady(page);
    await expect(page.getByLabel("label", { exact: true })).toHaveValue("Save");
    await expect(page.getByText("The text on the button.")).toBeVisible();
    await page.getByRole("tab", { name: "Events" }).click();
    await expect(page.getByText("onPress")).toBeVisible();
  });

  test("lists the args a JavaScript story's argTypes describe, and changes them", async ({ page }) => {
    await page.goto(story("cards-tile--default"));
    await isReady(page);
    await page.getByLabel("text", { exact: true }).fill("Changed");
    await expect(frameOf(page).getByTestId("tile")).toHaveText("Changed");
    await page
      .getByRole("group", { name: "size" })
      .getByRole("radio", { name: "large" })
      .check({ force: true });
    await expect(frameOf(page).getByTestId("tile")).toHaveAttribute("data-size", "large");
  });

  test("new args keep what was typed in a field, and a custom element's own state", async ({ page }) => {
    await page.goto(story("inputs-field--default"));
    await isReady(page);
    await frameOf(page).getByTestId("input").fill("Ada");
    await page.getByLabel("hint", { exact: true }).fill("Changed hint");
    await expect(frameOf(page).getByTestId("hint")).toHaveText("Changed hint");
    await expect(frameOf(page).getByTestId("input")).toHaveValue("Ada");
    await page.goto(story("inputs-counter--default"));
    await isReady(page);
    await frameOf(page).getByTestId("counter").click();
    await expect(frameOf(page).getByTestId("counter")).toHaveText("Clicks: 1");
    await page.getByLabel("label", { exact: true }).fill("Taps");
    await expect(frameOf(page).getByTestId("counter")).toHaveText("Taps: 1");
  });

  test("records the press a person makes", async ({ page }) => {
    await page.goto(story("inputs-button--default", "tab=events"));
    await isReady(page);
    await expect(page.getByRole("tabpanel").getByText("onPress")).toBeVisible();
    await frameOf(page).getByTestId("button").click();
    await expect(page.locator(".forgebook-calls__item")).toContainText(["onPress"]);
  });

  test("writes a story drawn from its args as its function's call", async ({ page }) => {
    await page.goto(story("inputs-button--default", "tab=code"));
    await isReady(page);
    await expect(page.getByRole("tabpanel")).toContainText('createButton({ label: "Save", tone: "info" })');
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

test.describe("a shared link's args", () => {
  test("apply when they are plain words", async ({ page }) => {
    await page.goto(story("cards-tile--default", `args=${encodeURIComponent('{"text":"Perché 50% off"}')}`));
    await isReady(page);
    await expect(frameOf(page).getByTestId("tile")).toHaveText("Perché 50% off");
  });

  test("never write markup into a story's HTML, which then draws its own value", async ({ page }) => {
    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    const args = {
      text: "<img src=x onerror=alert(document.domain)>",
      size: 'small" onmouseover="alert(1)',
      "x><img src=x onerror=alert(2)>": "a"
    };
    await page.goto(story("cards-tile--default", `args=${encodeURIComponent(JSON.stringify(args))}`));
    await isReady(page);
    await expect(frameOf(page).getByTestId("tile")).toHaveText("A tile");
    await expect(frameOf(page).getByTestId("tile")).toHaveAttribute("data-size", "small");
    await expect(frameOf(page).locator("img")).toHaveCount(0);
    await frameOf(page).getByTestId("tile").hover();
    expect(dialogs).toEqual([]);
  });

  test("follow the same rule in an embedded story, whose address the page around it writes", async ({
    page
  }) => {
    const args = { text: "<img src=x onerror=alert(document.domain)>", size: "large" };
    await page.goto(story("cards-tile--default", `embed&args=${encodeURIComponent(JSON.stringify(args))}`));
    await isReady(page);
    await expect(frameOf(page).getByTestId("tile")).toHaveText("A tile");
    await expect(frameOf(page).getByTestId("tile")).toHaveAttribute("data-size", "large");
    await expect(frameOf(page).locator("img")).toHaveCount(0);
  });
});

test("a function's story shows its signature first", async ({ page }) => {
  await page.goto(story("logic-format-count--default"));
  await isReady(page);
  await expect(page.getByRole("tab", { name: "Signature" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("count: number").first()).toBeVisible();
});
