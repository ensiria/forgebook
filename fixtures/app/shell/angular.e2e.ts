/**
 * A catalogue of Angular, in the browser: the Angular fixture, whose components Analog's plugin compiles ahead of time,
 * and whose inputs, outputs, projected content, templates and errors go through the same shell and frame as React's.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

import { ANGULAR_PORT } from "./ports";

test.use({ baseURL: `http://127.0.0.1:${ANGULAR_PORT}/` });

/** Every story of the fixture, by its id without the source. */
const STORY_IDS = [
  "inputs-badge--default",
  "inputs-badge--with-content",
  "inputs-badge--from-template",
  "inputs-badge--wrapped",
  "inputs-badge--removable",
  "inputs-counter--default",
  "inputs-counter--templated",
  "inputs-tooltip--on-button",
  "states-fragile--default",
  "states-greeting--live",
  "logic-inject-toggle--default"
];

/** The address of a story. */
const story = (id: string, query = ""): string => `/?story=angular:${id}${query === "" ? "" : `&${query}`}`;

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/** Waits until the shown story's frame says it is ready. */
const isReady = async (page: Page): Promise<void> => {
  await expect(page.locator("iframe.forgebook-frame-view")).toBeVisible();
  await expect
    .poll(async () => frameOf(page).locator("html").getAttribute("data-forgebook-status"))
    .toBe("ready");
};

test("every Angular story is ready in its frame, without a page error, React or the server render", async ({
  page
}) => {
  const errors: string[] = [];
  const scripts: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => scripts.push(response.url()));
  for (const id of STORY_IDS) {
    await page.goto(`/frame.html?story=angular:${id}`);
    await expect
      .poll(async () => page.locator("html").getAttribute("data-forgebook-status"), { message: id })
      .toBe("ready");
  }
  expect(errors).toEqual([]);
  expect(scripts.filter((url) => /react|platform-server|serverRender/.test(url))).toEqual([]);
});

test.describe("what a story draws", () => {
  test("the component from its args, its projected content, a template and a wrapper", async ({ page }) => {
    await page.goto("/frame.html?story=angular:inputs-badge--default");
    await expect(page.locator("fb-badge .badge--info")).toContainText("New");
    await page.goto("/frame.html?story=angular:inputs-badge--with-content");
    await expect(page.locator("fb-badge")).toHaveText(/^\*\s*New\s*from the content/);
    await page.goto("/frame.html?story=angular:inputs-badge--from-template");
    await expect(page.getByTestId("template").locator("fb-badge b[icon]")).toHaveText("!");
    await page.goto("/frame.html?story=angular:inputs-badge--wrapped");
    await expect(page.getByTestId("wrapped").locator(".badge--success")).toContainText("New");
  });

  test("a directive in the template its story writes", async ({ page }) => {
    await page.goto("/frame.html?story=angular:inputs-tooltip--on-button");
    await expect(page.getByRole("button", { name: "Save" })).toHaveAttribute("title", "Saved");
  });

  test("the preview's decorator is around every story, in the toolbar's language", async ({ page }) => {
    await page.goto("/frame.html?story=angular:inputs-badge--default");
    await expect(page.getByTestId("preview")).toContainText("New");
    await page.goto(story("states-greeting--live", "lang=it"));
    await isReady(page);
    await expect(frameOf(page).getByTestId("preview")).toHaveAttribute("data-lang", "it");
  });

  test("a story's texts follow the language, its clock is the story's, its application gives its providers", async ({
    page
  }) => {
    await page.goto(story("states-greeting--live"));
    await isReady(page);
    await expect(frameOf(page).getByTestId("greeting")).toHaveText("Hello 2030-01-01 from Forgebook");
    await page.goto(story("states-greeting--live", "lang=it"));
    await isReady(page);
    await expect(frameOf(page).getByTestId("greeting")).toHaveText("Ciao 2030-01-01 from Forgebook");
  });
});

test.describe("the panel on an Angular component", () => {
  test("lists the inputs, projected content and outputs read from the component", async ({ page }) => {
    await page.goto(story("inputs-badge--default"));
    await isReady(page);
    await expect(page.getByLabel("label", { exact: true })).toHaveValue("New");
    await expect(page.getByLabel("#default")).toBeVisible();
    await expect(page.getByLabel("#[icon]")).toBeVisible();
    await page.getByRole("tab", { name: "Events" }).click();
    await expect(page.getByText("removed", { exact: true })).toBeVisible();
    await expect(page.getByText("countChange", { exact: true })).toBeVisible();
    await expect(page.getByText("The person took it away.")).toBeVisible();
  });

  test("changes an input, a choice, and the projected content from its text", async ({ page }) => {
    await page.goto(story("inputs-badge--default"));
    await isReady(page);
    await page.getByLabel("label", { exact: true }).fill("Changed");
    await expect(frameOf(page).locator(".badge__label")).toHaveText("Changed");
    await page.getByRole("radio", { name: "danger" }).check({ force: true });
    await expect(frameOf(page).locator(".badge--danger")).toBeVisible();
    await page.getByLabel("#default").fill("in the content");
    await expect(frameOf(page).locator("fb-badge")).toContainText("in the content");
  });

  test("new args keep the state of a story drawn from its args and of one written as a template", async ({
    page
  }) => {
    for (const id of ["inputs-counter--default", "inputs-counter--templated"]) {
      await page.goto(story(id));
      await isReady(page);
      await frameOf(page).getByTestId("counter").click();
      await expect(frameOf(page).getByTestId("counter")).toHaveText("Clicks: 1");
      await page.getByLabel("label").fill("Taps");
      await expect(frameOf(page).getByTestId("counter")).toHaveText("Taps: 1");
    }
  });

  test("records the output a person sends, and the model's change", async ({ page }) => {
    await page.goto(story("inputs-badge--default", "tab=events"));
    await isReady(page);
    await frameOf(page).getByRole("button", { name: "Remove" }).click();
    await expect(page.locator(".forgebook-calls__item")).toContainText(["removed"]);
    await frameOf(page).locator(".badge__count").click();
    await expect(page.locator(".forgebook-calls__item").filter({ hasText: "countChange" })).toHaveCount(1);
  });

  test("writes the story as an Angular template, by the component's selector", async ({ page }) => {
    await page.goto(story("inputs-badge--default", "tab=code"));
    await isReady(page);
    await expect(page.getByRole("tabpanel")).toContainText(
      '<fb-badge label="New" tone="info" [count]="3"></fb-badge>'
    );
    await page.goto(story("inputs-badge--with-content", "tab=code"));
    await expect(page.getByRole("tabpanel")).toContainText("<div icon>*</div>");
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

test("a function's story shows its signature first", async ({ page }) => {
  await page.goto(story("logic-inject-toggle--default"));
  await isReady(page);
  await expect(page.getByRole("tab", { name: "Signature" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("WritableSignal<boolean>").first()).toBeVisible();
});
