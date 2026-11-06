/**
 * A catalogue of another framework, in the browser: the Vue fixture, whose single-file components, slots, templates,
 * events and errors go through the same shell and frame as React's.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

import { catalogueUrl } from "./ports";

test.use({ baseURL: catalogueUrl("vue") });

/** Every story of the fixture, by its id without the source. */
const STORY_IDS = [
  "inputs-badge--default",
  "inputs-badge--with-slots",
  "inputs-badge--from-vnode",
  "inputs-badge--from-template",
  "inputs-badge--removable",
  "inputs-counter--default",
  "states-awaited--default",
  "states-fragile--default",
  "states-greeting--live",
  "logic-use-toggle--default"
];

/** The address of a story. */
const story = (id: string, query = ""): string => `/?story=vue:${id}${query === "" ? "" : `&${query}`}`;

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/** Waits until the shown story's frame says it is ready. */
const isReady = async (page: Page): Promise<void> => {
  await expect(page.locator("iframe.forgebook-frame-view")).toBeVisible();
  await expect
    .poll(async () => frameOf(page).locator("html").getAttribute("data-forgebook-status"))
    .toBe("ready");
};

test("every Vue story is ready in its frame, without a page error and without React", async ({ page }) => {
  const errors: string[] = [];
  const scripts: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => scripts.push(response.url()));
  for (const id of STORY_IDS) {
    await page.goto(`/frame.html?story=vue:${id}`);
    await expect
      .poll(async () => page.locator("html").getAttribute("data-forgebook-status"), { message: id })
      .toBe("ready");
  }
  expect(errors).toEqual([]);
  expect(scripts.filter((url) => /react|server-renderer/.test(url))).toEqual([]);
});

test.describe("what a story draws", () => {
  test("a template and a virtual node both draw the single-file component", async ({ page }) => {
    await page.goto("/frame.html?story=vue:inputs-badge--from-template");
    await expect(page.getByTestId("template")).toContainText("New");
    await page.goto("/frame.html?story=vue:inputs-badge--from-vnode");
    await expect(page.locator(".badge--danger")).toContainText("New");
  });

  test("the preview's decorator is around every story", async ({ page }) => {
    await page.goto("/frame.html?story=vue:inputs-badge--default");
    await expect(page.getByTestId("preview")).toContainText("New");
  });

  test("a component that awaits is drawn, and its play finds it", async ({ page }) => {
    await page.goto(story("states-awaited--default"));
    await isReady(page);
    await expect(frameOf(page).getByTestId("awaited")).toHaveText("Awaited");
    await expect(page.getByRole("tab", { name: /Interactions/ })).toContainText("passed");
  });

  test("a play's result shows while the component's docs are still read", async ({ page }) => {
    // a first read of a project's docs can take longer than an assertion waits: held here until the play is seen
    let releaseDocs = (): void => undefined;
    const docsHeld = new Promise<void>((resolve) => {
      releaseDocs = resolve;
    });
    await page.route(/[?&]forgebook-docs\b/, async (route) => {
      await docsHeld;
      await route.continue();
    });
    await page.goto(story("states-awaited--default"));
    await isReady(page);
    await expect(page.getByRole("tab", { name: /Interactions/ })).toContainText("passed");
    await expect(page.getByText("Reading the component…")).toBeVisible();
    releaseDocs();
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

test.describe("the panel on a Vue component", () => {
  test("lists the props, slots and events read from a single-file component", async ({ page }) => {
    await page.goto(story("inputs-badge--default"));
    await isReady(page);
    await expect(page.getByLabel("label", { exact: true })).toHaveValue("New");
    await expect(page.getByLabel("#default", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Events" }).click();
    await expect(page.getByText("onRemove")).toBeVisible();
    await expect(page.getByText("The person took it away.")).toBeVisible();
  });

  test("changes a prop, and a slot from its text", async ({ page }) => {
    await page.goto(story("inputs-badge--default"));
    await isReady(page);
    await page.getByLabel("label", { exact: true }).fill("Changed");
    await expect(frameOf(page).locator(".badge")).toContainText("Changed");
    await page.getByLabel("#default", { exact: true }).fill("in the slot");
    await expect(frameOf(page).locator(".badge")).toContainText("in the slot");
  });

  test("new args keep the state of a story written as a template", async ({ page }) => {
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
    // the frame records the events the component's docs name: they may arrive after the story on a first read
    await expect(page.getByRole("tabpanel")).toContainText("onRemove");
    await frameOf(page).getByRole("button", { name: "Remove" }).click();
    await expect(page.locator(".forgebook-calls__item")).toContainText(["onRemove"]);
  });

  test("writes the story as a template, with the values of the moment", async ({ page }) => {
    await page.goto(story("inputs-badge--default", "tab=code"));
    await isReady(page);
    await expect(page.getByRole("tabpanel")).toContainText('<Badge label="New" tone="info" :count="3" />');
    await page.goto(story("inputs-badge--with-slots", "tab=code"));
    await expect(page.getByRole("tabpanel")).toContainText("<template #icon>*</template>");
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

test("a composable's story shows its signature first", async ({ page }) => {
  await page.goto(story("logic-use-toggle--default"));
  await isReady(page);
  await expect(page.getByRole("tab", { name: "Signature" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Ref<boolean>").first()).toBeVisible();
});
