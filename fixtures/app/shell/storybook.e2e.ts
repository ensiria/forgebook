/**
 * Stories written the Storybook way, in the browser, on the fixture's Storybook source: a title from the path, tags,
 * CSF 2, the meta's render and play, loaders, plays with `storybook/test` and the context's tools, arg types in the
 * panel, actions in Events, a story's globals over the toolbar, a file's exports, a `.jsx` file, a title written in
 * two files, Storybook's ids and the former ones.
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

/**
 * Every story of the Storybook fixture, by its id without the source, but the hot-edit file's: `hotEdit.e2e.ts` edits
 * that file while this spec may run, and checks its stories itself.
 */
const STORY_IDS = [
  "components-button--primary",
  "components-button--secondary",
  "components-button--unlisted",
  "components-button--untested",
  "storybook-arg-types--controls",
  "storybook-arg-types--conditional",
  "storybook-custom-controls--rated",
  "storybook-value-props--filled",
  "storybook-value-props--empty",
  "storybook-value-props--with-tokens",
  "storybook-value-props--named-controls",
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
  "storybook-merged--overview",
  "storybook-merged--made",
  "storybook-merged--aliased",
  "storybook-merged--wrapping",
  "storybook-merged--reexported",
  "storybook-plain-javascript--untyped",
  "storybook-preview-hooks--synced"
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
    await page.goto(story("storybook-plain-javascript--untyped"));
    await isReady(page);
    await expect(frameOf(page).getByRole("button")).toHaveText("From a .jsx file");
  });
});

test.describe("a title written in several files, and ids", () => {
  test("files with one title make one component, each story from its own file with its own meta", async ({
    page
  }) => {
    await page.goto(story("storybook-merged--wrapping"));
    await isReady(page);
    await expect(pickerOptions(page)).toHaveText([
      "All 5 stories",
      "Overview",
      "Made",
      "Aliased",
      "Wrapping",
      "Reexported"
    ]);
    // the second file's meta gives its stories their variant
    await expect(frameOf(page).getByRole("button")).toHaveAttribute("data-variant", "secondary");
    await page.goto("/?component=sb:storybook-merged");
    const examples = page.locator(".forgebook-example:not([data-demo])");
    await expect(examples).toHaveCount(4);
    // the code of a story of the second file, on the page the first file's docs lead
    const wrapping = examples.filter({ hasText: "Wrapping" });
    await wrapping.getByRole("button", { name: "Show code" }).click();
    await expect(wrapping.locator(".forgebook-example__code")).toContainText("A label long enough to wrap");
    await expect(page.locator(".forgebook-api__table").first().locator("tbody th")).toContainText(["label"]);
  });

  test("a story a helper makes, another constant and a re-export are drawn", async ({ page }) => {
    await page.goto(story("storybook-merged--made"));
    await isReady(page);
    await expect(frameOf(page).getByRole("button")).toHaveText("Made by a helper");
    await page.goto(story("storybook-merged--aliased"));
    await isReady(page);
    await expect(frameOf(page).getByRole("button")).toHaveText("From another constant");
    await page.goto(story("storybook-merged--reexported"));
    await isReady(page);
    await expect(frameOf(page).getByRole("button")).toHaveText("From another module");
  });

  test("an address with the id the former rule gave a story or a component opens it under its own", async ({
    page
  }) => {
    await page.goto(story("storybook-plain-java-script--untyped"));
    await isReady(page);
    await expect(frameOf(page).getByRole("button")).toHaveText("From a .jsx file");
    await expect(page).toHaveURL(/story=sb%3Astorybook-plain-javascript--untyped/);
    await page.goto("/?component=sb:storybook-plain-java-script");
    await expect(page).toHaveURL(/component=sb%3Astorybook-plain-javascript/);
    await expect(page.locator(".forgebook-example").first()).toBeVisible();
    // a frame opened by the former id draws its story too
    await page.goto("/frame.html?story=sb:storybook-plain-java-script--untyped");
    await expect.poll(async () => page.locator("html").getAttribute("data-forgebook-status")).toBe("ready");
  });
});

test.describe("arg types and actions", () => {
  test("the panel draws the arg types' controls, and each reaches the story", async ({ page }) => {
    await page.goto(story("storybook-arg-types--controls"));
    await isReady(page);
    // a hidden arg has no control; the others have the control their arg type names
    await expect(page.getByLabel("secret", { exact: true })).toHaveCount(0);
    await page.getByRole("combobox", { name: "tone" }).selectOption("loud");
    await expect.poll(async () => (await shownArgs(page))["tone"]).toBe("loud");
    await page.getByRole("radio", { name: "Large" }).check({ force: true });
    await expect.poll(async () => (await shownArgs(page))["size"]).toBe("l");
    await page.getByRole("checkbox", { name: "end" }).check();
    await expect.poll(async () => (await shownArgs(page))["sides"]).toEqual(["top", "end"]);
    await page.getByRole("slider", { name: "volume" }).fill("8");
    await expect.poll(async () => (await shownArgs(page))["volume"]).toBe(8);
    await expect(page.getByLabel("When", { exact: true })).toHaveAttribute("type", "datetime-local");
    // a mapping's key chosen in the panel reaches the story as its value
    await page.getByRole("combobox", { name: "icon" }).selectOption("heart");
    await expect.poll(async () => (await shownArgs(page))["icon"]).toBe("♥");
  });

  test("the panel follows an arg's `if`: another arg's value, and a global's", async ({ page }) => {
    await page.goto(story("storybook-arg-types--conditional", "theme=light"));
    await isReady(page);
    await expect(page.getByRole("textbox", { name: "secret" })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "icon" })).toHaveCount(0);
    await page.getByRole("combobox", { name: "tone" }).selectOption("loud");
    await expect(page.getByRole("textbox", { name: "secret" })).toBeVisible();
    // hiding the control leaves the value alone, as Storybook's does
    await page.getByRole("combobox", { name: "tone" }).selectOption("calm");
    await expect(page.getByRole("textbox", { name: "secret" })).toHaveCount(0);
    await expect.poll(async () => (await shownArgs(page))["secret"]).toBe("hidden");
    await page.goto(story("storybook-arg-types--conditional", "theme=dark"));
    await isReady(page);
    await expect(page.getByRole("combobox", { name: "icon" })).toBeVisible();
  });

  test("a Storybook link's path opens the story, and is checked as any other story's name", async ({
    page
  }) => {
    await page.goto("/?path=/story/inputs-selection-select--small&args=hint:From+a+link");
    await expect(page).toHaveTitle("Select · Fixture catalogue");
    await expect(page.locator("iframe.forgebook-frame-view").first()).toHaveAttribute(
      "src",
      /story=kit%3Ainputs-selection-select--small|story=kit:inputs-selection-select--small/
    );
    const frame = page.frameLocator("iframe.forgebook-frame-view").first();
    await expect(frame.locator("small")).toHaveText("From a link");
    await page.goto(`/?path=/story/${encodeURIComponent("<img src=x>--nowhere")}`);
    await expect(page.getByRole("alert")).toContainText("<img src=x>--nowhere");
    await expect(page.locator("iframe.forgebook-frame-view")).toHaveCount(0);
    await expect(page.locator("main img")).toHaveCount(0);
  });

  test("a Storybook link's path opens the story alone in an embed", async ({ page }) => {
    await page.goto("/?embed&path=/story/inputs-selection-select--small");
    await expect(page.frameLocator("iframe.forgebook-frame-view").locator("html")).toHaveAttribute(
      "data-forgebook-status",
      "ready"
    );
  });

  test("a Storybook link's args are read and typed by the props, and stay in the address", async ({
    page
  }) => {
    const args =
      "tone:loud;volume:6;sides[0]:end;sides[1]:start;color:!hex(ff0000);size:l;missing:x;style.a:b";
    await page.goto(story("storybook-arg-types--controls", `args=${args}`));
    await isReady(page);
    await expect
      .poll(async () => shownArgs(page))
      .toMatchObject({ tone: "loud", volume: 6, sides: ["end", "start"], color: "#ff0000", size: "l" });
    // what cannot be taken is said, by name and reason, never dropped silently
    const note = page.locator(".forgebook-dropped-args");
    await expect(note.getByRole("listitem").filter({ hasText: "style" })).toContainText("could not be read");
    await expect(note.getByRole("listitem").filter({ hasText: "missing" })).toContainText(
      "not one of its props"
    );
    // the address goes on saying the same, so a reload reads it again
    await page.reload();
    await isReady(page);
    await expect.poll(async () => (await shownArgs(page))["volume"]).toBe(6);
    // a change starts from what the story takes, typed, in Forgebook's own form
    await page.getByRole("combobox", { name: "tone" }).selectOption("angry");
    await expect(page).toHaveURL(/args=%7B/);
    await expect(note).toHaveCount(0);
    await page.reload();
    await isReady(page);
    await expect
      .poll(async () => shownArgs(page))
      .toMatchObject({ tone: "angry", volume: 6, sides: ["end", "start"], color: "#ff0000", size: "l" });
  });

  test("a link's non-ASCII text and lists reach the story in either form", async ({ page }) => {
    const text = "Perché 日本語 🎉";
    await page.goto(
      story(
        "storybook-arg-types--controls",
        `args=${encodeURIComponent(JSON.stringify({ tone: "loud", sides: ["end"], color: text }))}`
      )
    );
    await isReady(page);
    await expect
      .poll(async () => shownArgs(page))
      .toMatchObject({ tone: "loud", sides: ["end"], color: text });
    await page.goto(
      story("storybook-arg-types--controls", `args=sides[]:end;color:${encodeURIComponent(text)}`)
    );
    await isReady(page);
    await expect.poll(async () => shownArgs(page)).toMatchObject({ sides: ["end"], color: text });
  });

  test("a JSON address that cannot be read says so", async ({ page }) => {
    await page.goto(story("storybook-arg-types--controls", "args=%7Bnot-json"));
    await isReady(page);
    await expect(page.locator(".forgebook-dropped-args")).toContainText("could not be read");
  });

  test("a story changes its own args with Storybook's useArgs, and the panel and the address follow", async ({
    page
  }) => {
    await page.goto(story("storybook-preview-hooks--synced"));
    await isReady(page);
    // the render's update, from a click in the story
    await frameOf(page).getByRole("button", { name: "Add" }).click();
    await expect.poll(async () => (await shownArgs(page))["count"]).toBe(1);
    await expect(page.getByRole("spinbutton", { name: "count" })).toHaveValue("1");
    await expect(page).toHaveURL(/args=[^&]*count/);
    // the decorator's update, in an effect, after the panel changed the arg it follows
    await page.getByRole("combobox", { name: "kind" }).selectOption("bot");
    await expect.poll(async () => (await shownArgs(page))["name"]).toBe("dependabot");
    await expect(page.getByRole("textbox", { name: "name" })).toHaveValue("dependabot");
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

test.describe("a story's mocked API", () => {
  /** A service worker's first install, on a cold runner, takes longer than a story's first draw, in milliseconds. */
  const workerStart = 20_000;

  test("answers a story's fetch from its handlers, as a list or a record of lists", async ({ page }) => {
    await page.goto(story("fetching-mocked--answered"));
    await expect(frameOf(page).getByTestId("greeting")).toHaveText("Hello from a mock", {
      timeout: workerStart
    });
    await page.goto(story("fetching-mocked--answered-by-name"));
    await expect(frameOf(page).getByTestId("greeting")).toHaveText("Named mock", { timeout: workerStart });
  });

  test("loads nothing of MSW for a story with no handlers, and lets its request go", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(story("fetching-mocked--unmocked"));
    await expect(frameOf(page).getByTestId("greeting")).toHaveText("No answer");
    expect(requests.filter((url) => url.includes("mockServiceWorker"))).toEqual([]);
    expect(requests.filter((url) => url.includes("msw_browser"))).toEqual([]);
  });
});
