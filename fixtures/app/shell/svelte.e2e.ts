/**
 * A catalogue of another framework, in the browser: the Svelte fixture, whose components, snippets, callback props, an
 * `await` and errors go through the same shell and frame as React's.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

import { SVELTE_PORT } from "./ports";

test.use({ baseURL: `http://127.0.0.1:${SVELTE_PORT}/` });

/** Every story of the fixture, by its id without the source. */
const STORY_IDS = [
  "inputs-badge--default",
  "inputs-badge--with-snippets",
  "inputs-badge--from-render",
  "inputs-badge--removable",
  "inputs-counter--default",
  "states-awaited--default",
  "states-fragile--default",
  "states-greeting--live",
  "logic-create-toggle--default"
];

/** The address of a story. */
const story = (id: string, query = ""): string => `/?story=svelte:${id}${query === "" ? "" : `&${query}`}`;

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/** Waits until the shown story's frame says it is ready. */
const isReady = async (page: Page): Promise<void> => {
  await expect(page.locator("iframe.forgebook-frame-view")).toBeVisible();
  await expect
    .poll(async () => frameOf(page).locator("html").getAttribute("data-forgebook-status"))
    .toBe("ready");
};

test("every Svelte story is ready in its frame, without a page error, React or the server render", async ({
  page
}) => {
  const errors: string[] = [];
  const scripts: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => scripts.push(response.url()));
  for (const id of STORY_IDS) {
    await page.goto(`/frame.html?story=svelte:${id}`);
    await expect
      .poll(async () => page.locator("html").getAttribute("data-forgebook-status"), { message: id })
      .toBe("ready");
  }
  expect(errors).toEqual([]);
  // Svelte's own `svelte/reactivity` is no React
  expect(scripts.filter((url) => /react(?!iv)|svelte_server/.test(url))).toEqual([]);
});

test.describe("what a story draws", () => {
  test("a render that returns the component with props of its own draws them", async ({ page }) => {
    await page.goto("/frame.html?story=svelte:inputs-badge--from-render");
    await expect(page.locator(".badge--danger")).toContainText("New");
  });

  test("the preview's decorator is around every story", async ({ page }) => {
    await page.goto("/frame.html?story=svelte:inputs-badge--default");
    await expect(page.getByTestId("preview")).toContainText("New");
  });

  test("a component that awaits is drawn, and its play finds it", async ({ page }) => {
    await page.goto(story("states-awaited--default"));
    await isReady(page);
    await expect(frameOf(page).getByTestId("awaited")).toHaveText("Awaited");
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

test.describe("the panel on a Svelte component", () => {
  test("lists the props, snippets and callback props read from a .svelte file", async ({ page }) => {
    await page.goto(story("inputs-badge--default"));
    await isReady(page);
    await expect(page.getByLabel("label", { exact: true })).toHaveValue("New");
    await expect(page.getByLabel("#children")).toBeVisible();
    await page.getByRole("tab", { name: "Events" }).click();
    await expect(page.getByText("onremove")).toBeVisible();
    await expect(page.getByText("The person took it away.")).toBeVisible();
  });

  test("changes a prop, and a snippet from its text", async ({ page }) => {
    await page.goto(story("inputs-badge--default"));
    await isReady(page);
    await page.getByLabel("label", { exact: true }).fill("Changed");
    await expect(frameOf(page).locator(".badge")).toContainText("Changed");
    await page.getByLabel("#children").fill("in the snippet");
    await expect(frameOf(page).locator(".badge")).toContainText("in the snippet");
  });

  test("new args keep the state of a story's component", async ({ page }) => {
    await page.goto(story("inputs-counter--default"));
    await isReady(page);
    await frameOf(page).getByTestId("counter").click();
    await expect(frameOf(page).getByTestId("counter")).toHaveText("Clicks: 1");
    await page.getByLabel("label", { exact: true }).fill("Taps");
    await expect(frameOf(page).getByTestId("counter")).toHaveText("Taps: 1");
  });

  test("records the event a person sends", async ({ page }) => {
    await page.goto(story("inputs-badge--default", "tab=events"));
    await isReady(page);
    await frameOf(page).getByRole("button", { name: "Remove" }).click();
    await expect(page.locator(".forgebook-calls__item")).toContainText(["onremove"]);
  });

  test("writes the story as Svelte markup, with the values of the moment", async ({ page }) => {
    await page.goto(story("inputs-badge--default", "tab=code"));
    await isReady(page);
    await expect(page.getByRole("tabpanel")).toContainText('<Badge label="New" tone="info" count={3} />');
    await page.goto(story("inputs-badge--with-snippets", "tab=code"));
    await expect(page.getByRole("tabpanel")).toContainText("{#snippet icon()}*{/snippet}");
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
  await page.goto(story("logic-create-toggle--default"));
  await isReady(page);
  await expect(page.getByRole("tab", { name: "Signature" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Toggle").first()).toBeVisible();
});
