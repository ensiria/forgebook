/**
 * Stories written the Storybook way, in the browser, on the fixture's Storybook source: a title from the path, tags,
 * CSF 2, the meta's render and play, loaders, plays with `storybook/test` and the context's tools, arg types in the
 * panel, actions in Events, a story's globals over the toolbar, a file's exports and a `.jsx` file.
 *
 * @module
 */

import { expect, type FrameLocator, type Locator, type Page, test } from "@playwright/test";

/** The address of a story of the Storybook fixture. */
const story = (id: string, query = ""): string => `/?story=sb:${id}${query === "" ? "" : `&${query}`}`;

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/** The story picker's options, by name. */
const pickerOptions = (page: Page): Locator => page.locator(".forgebook-picker__select option");

/** Waits until the shown story's frame says it is ready. */
const isReady = async (page: Page): Promise<void> => {
  await expect(page.locator("iframe.forgebook-frame-view")).toBeVisible();
  await expect
    .poll(async () => frameOf(page).locator("html").getAttribute("data-forgebook-status"))
    .toBe("ready");
};

/** The story's args, as the arg types story writes them in its frame. */
const shownArgs = async (page: Page): Promise<Record<string, unknown>> => {
  const text = await frameOf(page).getByTestId("args").textContent();
  return JSON.parse(text ?? "{}") as Record<string, unknown>;
};

/** Every story of the Storybook fixture, by its id without the source. */
const STORY_IDS = [
  "components-button--primary",
  "components-button--secondary",
  "components-button--unlisted",
  "components-button--untested",
  "storybook-arg-types--controls",
  "storybook-csf-2--primary",
  "storybook-csf-2--large",
  "storybook-meta-render-and-play--from-meta",
  "storybook-meta-render-and-play--own-render",
  "storybook-loaders--loaded",
  "storybook-play--with-storybook-test",
  "storybook-play--with-context",
  "storybook-actions--spy",
  "storybook-actions--named",
  "storybook-globals--fixed",
  "storybook-globals--from-parameters",
  "storybook-formats-exports-button--first",
  "storybook-formats-exports-button--second",
  "storybook-formats-exports-button--renamed",
  "storybook-plain-java-script--untyped"
];

test("every story written the Storybook way is ready in its frame, without a page error", async ({
  page
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const id of STORY_IDS) {
    await page.goto(`/frame.html?story=sb:${id}`);
    await expect
      .poll(async () => page.locator("html").getAttribute("data-forgebook-status"), { message: id })
      .toBe("ready");
  }
  expect(errors).toEqual([]);
});

test.describe("files written the Storybook way", () => {
  test("a file without a title is placed by its path, and a story tagged !dev is listed nowhere", async ({
    page
  }) => {
    await page.goto(story("components-button--primary"));
    await isReady(page);
    await expect(page.getByRole("navigation", { name: "Components" })).toContainText("components");
    await expect(pickerOptions(page)).toHaveText(["All 3 stories", "Primary", "Secondary", "Untested"]);
    // still opened by its address, as Storybook's
    await page.goto(story("components-button--unlisted"));
    await isReady(page);
    await expect(frameOf(page).getByRole("button")).toHaveText("Unlisted");
  });

  test("CSF 2 stories bound from a template take the name and args assigned after them", async ({ page }) => {
    await page.goto(story("storybook-csf-2--primary"));
    await isReady(page);
    await expect(frameOf(page).getByRole("button")).toHaveText("From a function");
    await expect(pickerOptions(page)).toContainText(["The primary one"]);
  });

  test("the meta's render and play draw and play a component made by memo and forwardRef", async ({
    page
  }) => {
    await page.goto(story("storybook-meta-render-and-play--from-meta", "tab=play"));
    await isReady(page);
    await expect(frameOf(page).locator("p")).toHaveText("From the meta: Badge");
    await expect(page.getByRole("tab", { name: /Interactions/ })).toContainText("passed");
  });

  test("loaders and beforeEach run before the story is drawn", async ({ page }) => {
    await page.goto(story("storybook-loaders--loaded", "tab=play"));
    await isReady(page);
    await expect(frameOf(page).getByTestId("loaded")).toHaveText("Hello Ada, mock on");
    await expect(page.getByRole("tab", { name: /Interactions/ })).toContainText("passed");
  });

  test("plays pass with storybook/test's helpers and with the context's canvas and userEvent", async ({
    page
  }) => {
    await page.goto(story("storybook-play--with-storybook-test", "tab=play"));
    await isReady(page);
    await expect(frameOf(page).getByRole("button")).toHaveText("Pressed 2");
    await expect(page.locator(".forgebook-play__label")).toHaveText(["press twice"]);
    await page.goto(story("storybook-play--with-context", "tab=play"));
    await isReady(page);
    await expect(frameOf(page).getByRole("button")).toHaveText("Pressed 1");
    await expect(page.getByRole("tab", { name: /Interactions/ })).toContainText("passed");
  });

  test("a file's exports become stories in its own order, without its data, a computed name the export's", async ({
    page
  }) => {
    await page.goto(story("storybook-formats-exports-button--second"));
    await isReady(page);
    await expect(pickerOptions(page)).toHaveText(["All 3 stories", "First", "Second", "Renamed"]);
    await expect(page.locator(".forgebook-stage__description")).toHaveText(
      "Its description comes from the docs parameter."
    );
  });

  test("a story file in plain JavaScript is drawn", async ({ page }) => {
    await page.goto(story("storybook-plain-java-script--untyped"));
    await isReady(page);
    await expect(frameOf(page).getByRole("button")).toHaveText("From a .jsx file");
  });
});

test.describe("arg types and actions", () => {
  test("the panel draws the arg types' controls, and each reaches the story", async ({ page }) => {
    await page.goto(story("storybook-arg-types--controls"));
    await isReady(page);
    // a hidden arg has no control; the others have the control their arg type names
    await expect(page.getByLabel("secret")).toHaveCount(0);
    await page.getByRole("combobox", { name: "tone" }).selectOption("loud");
    await expect.poll(async () => (await shownArgs(page))["tone"]).toBe("loud");
    await page.getByRole("radio", { name: "Large" }).check({ force: true });
    await expect.poll(async () => (await shownArgs(page))["size"]).toBe("l");
    await page.getByRole("checkbox", { name: "end" }).check();
    await expect.poll(async () => (await shownArgs(page))["sides"]).toEqual(["top", "end"]);
    await page.getByRole("slider", { name: "volume" }).fill("8");
    await expect.poll(async () => (await shownArgs(page))["volume"]).toBe(8);
    await expect(page.getByLabel("When")).toHaveAttribute("type", "datetime-local");
    // a mapping's key chosen in the panel reaches the story as its value
    await page.getByRole("combobox", { name: "icon" }).selectOption("heart");
    await expect.poll(async () => (await shownArgs(page))["icon"]).toBe("♥");
  });

  test("a spy's calls are recorded in Events, and the play still checks the spy", async ({ page }) => {
    await page.goto(story("storybook-actions--spy", "tab=events"));
    await isReady(page);
    await expect(page.locator(".forgebook-calls__item")).toContainText(["onClick"]);
    await page.getByRole("tab", { name: /Interactions/ }).click();
    await expect(page.getByRole("tab", { name: /Interactions/ })).toContainText("passed");
  });

  test("an arg types action on an arg the component does not type is recorded in Events", async ({
    page
  }) => {
    await page.goto(story("storybook-actions--named", "tab=events"));
    await isReady(page);
    await frameOf(page).getByRole("button", { name: "Close" }).click();
    await expect(page.locator(".forgebook-calls__item")).toContainText(["onClose"]);
  });
});

test.describe("a story's globals", () => {
  test("fix the theme, the background and the width, which the toolbar shows as set by the story", async ({
    page
  }) => {
    await page.goto(story("storybook-globals--fixed"));
    await isReady(page);
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-theme", "dark");
    const theme = page.locator(".forgebook-toolbar").getByRole("group", { name: "Theme" });
    await expect(theme).toHaveAttribute("title", "Set by the story");
    await expect(theme.getByRole("radio", { name: "Dark" })).toBeDisabled();
    await expect(theme.getByRole("radio", { name: "Dark" })).toBeChecked();
    const box = await page.locator("iframe.forgebook-frame-view").boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(412);
    // the view's own values are untouched: no dot, and the address keeps none of the story's
    await expect(page.getByRole("img", { name: "A view setting is changed" })).toHaveCount(0);
    await expect(page).not.toHaveURL(/theme=dark/);
  });

  test("keep Compare from setting a switch the story fixes side by side", async ({ page }) => {
    await page.goto(story("storybook-globals--fixed"));
    await isReady(page);
    await page.getByRole("button", { name: "Compare" }).click();
    await expect(
      page.getByRole("dialog", { name: "Compare" }).getByRole("radio", { name: /Theme/ })
    ).toBeDisabled();
  });

  test("Storybook's older background and viewport parameters pick the catalogue's", async ({ page }) => {
    await page.goto(story("storybook-globals--from-parameters"));
    await isReady(page);
    const box = await page.locator("iframe.forgebook-frame-view").boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(560);
  });
});
