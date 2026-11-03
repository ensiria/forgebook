/**
 * A React Native project's components in the browser: the React Native fixture (`fixtures/react-native`), drawn through
 * react-native-web by the same shell and frame as React's, its fonts, icons, images, web files, Flow and full-screen
 * screens as a phone draws them.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

import { catalogueUrl } from "./ports";

test.use({ baseURL: catalogueUrl("react-native") });

/** Every story of the fixture, by its id without the source. */
const STORY_IDS = [
  "crew-profile-card--plain",
  "crew-profile-card--online",
  "crew-profile-card--follows",
  "today-task-list--morning",
  "today-task-list--ticking",
  "today-task-list--empty",
  "today-tide-time--afternoon",
  "controls-icon-button--boat",
  "controls-icon-button--large-anchor",
  "controls-platform-note--on-the-web",
  "screens-harbour--morning",
  "crew-tag-chip--plain",
  "crew-tag-chip--main",
  "controls-beacon-pulse--steady",
  "controls-battery-badge--charged",
  "controls-battery-badge--low",
  "controls-battery-badge--without-module"
];

/**
 * The shell's address of a story.
 *
 * @param id - the story's id without its source.
 * @param query - more of the address (`theme=dark`).
 */
const story = (id: string, query = ""): string => `/?story=stories:${id}${query === "" ? "" : `&${query}`}`;

/**
 * The frame's address of a story.
 *
 * @param id - the story's id without its source.
 */
const frame = (id: string): string => `/frame.html?story=stories:${id}`;

/**
 * The shown story's frame.
 *
 * @param page - the shell's page.
 */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/**
 * Waits until a page's own story (a frame opened on its own) is ready.
 *
 * @param page - the frame's page.
 */
const isReady = async (page: Page): Promise<void> => {
  await expect.poll(async () => page.locator("html").getAttribute("data-forgebook-status")).toBe("ready");
};

/**
 * Whether the page loaded a font of a family, its face's file fetched and read.
 *
 * @param page - the page.
 * @param family - the family, as the page's `FontFace` names it.
 */
const hasLoadedFont = (page: Page, family: string): Promise<boolean> =>
  page.evaluate(async (name) => {
    await document.fonts.ready;
    return [...document.fonts].some(
      (font) => font.family.replaceAll('"', "") === name && font.status === "loaded"
    );
  }, family);

test("every story is ready in its frame, without a page error or a warning of React Native's", async ({
  page
}) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") problems.push(message.text());
  });
  for (const id of STORY_IDS) {
    await page.goto(frame(id));
    await isReady(page);
  }
  expect(problems).toEqual([]);
});

test.describe("React Native's primitives", () => {
  test("a view, texts, an image required as React Native names it, and a pressable, laid out as on a phone", async ({
    page
  }) => {
    await page.goto(frame("crew-profile-card--online"));
    await isReady(page);
    await expect(page.getByText("Ada Brennan")).toBeVisible();
    await expect(page.getByTestId("online-dot")).toBeVisible();
    // react-native-web draws an image as a background, with an image element its screen readers read: the file was
    // served, at the address the require became
    const avatar = page.getByRole("img", { name: "Ada Brennan's avatar" });
    await expect(avatar).toHaveAttribute("src", /avatar\.png$/);
    await expect.poll(async () => avatar.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(64);
    // the card is a row: the avatar left of the name, the button at the end
    const name = await page.getByText("Ada Brennan").boundingBox();
    const button = await page.getByRole("button", { name: "Follow" }).boundingBox();
    expect(name !== null && button !== null && button.x > name.x && Math.abs(button.y - name.y) < 30).toBe(
      true
    );
  });

  test("a list ticks a task when it is pressed, and says so when it is empty", async ({ page }) => {
    // the play presses a task and waits for it to be ticked
    await page.goto(story("today-task-list--ticking"));
    await expect(page.getByRole("tab", { name: /Interactions/ })).toContainText("passed");
    await page.goto(frame("today-task-list--morning"));
    await isReady(page);
    const fuel = page.getByRole("checkbox", { name: "Log the fuel" });
    await expect(fuel).toHaveAttribute("aria-checked", "false");
    await fuel.click();
    await expect(fuel).toHaveAttribute("aria-checked", "true");
    await page.goto(frame("today-task-list--empty"));
    await expect(page.getByText("All done for today")).toBeVisible();
  });

  test("a press calls the story's handler, which the Events tab lists with its value", async ({ page }) => {
    await page.goto(story("crew-profile-card--plain"));
    await frameOf(page).getByRole("button", { name: "Follow" }).click();
    await page.getByRole("tab", { name: /Events/ }).click();
    await expect(page.getByText(/onFollow/).first()).toBeVisible();
    await expect(page.getByText(/Ada Brennan/).first()).toBeVisible();
  });

  test("the panel sets a prop, read from the component's TypeScript props, and the story draws it", async ({
    page
  }) => {
    await page.goto(story("crew-profile-card--plain"));
    const field = page.getByRole("textbox", { name: "role", exact: true });
    await expect(field).toHaveValue("First mate");
    await field.fill("Skipper");
    await expect(frameOf(page).getByText("Skipper")).toBeVisible();
  });
});

test.describe("what Metro does for a phone", () => {
  test("a .web.tsx file wins over the phone's, and Platform.OS is web", async ({ page }) => {
    await page.goto(frame("controls-platform-note--on-the-web"));
    await isReady(page);
    await expect(page.getByTestId("platform-note")).toHaveText("Running on web (web file)");
  });

  test("JSX in a .js file and Flow's types are compiled, as Metro compiles them", async ({ page }) => {
    await page.goto(frame("screens-harbour--morning"));
    await isReady(page);
    await expect(page.getByTestId("wind-speed")).toHaveText("Wind 14.0 kn");
  });

  test("a font loaded with Expo's useFonts draws the text, its file required as React Native names it", async ({
    page
  }) => {
    await page.goto(frame("today-tide-time--afternoon"));
    await isReady(page);
    await expect(page.getByTestId("tide-time")).toHaveCSS("font-family", /JetBrainsMono/);
    await expect.poll(() => hasLoadedFont(page, "JetBrainsMono")).toBe(true);
  });

  test("an icon of @expo/vector-icons is a glyph of its font, which Expo loads", async ({ page }) => {
    await page.goto(frame("controls-icon-button--boat"));
    await isReady(page);
    await expect(page.getByRole("button", { name: "Boats" })).toBeVisible();
    await expect.poll(() => hasLoadedFont(page, "ionicons")).toBe(true);
  });
});

test.describe("what a Babel plugin and a style sheet's PostCSS do", () => {
  test("NativeWind's classes style React Native's components, and its dark classes follow the theme", async ({
    page
  }) => {
    await page.goto(frame("crew-tag-chip--main"));
    await isReady(page);
    const chip = page.getByTestId("tag-chip");
    await expect(chip).toHaveCSS("background-color", "rgb(42, 111, 151)");
    await expect(chip).toHaveCSS("border-radius", "9999px");
    await expect(page.getByTestId("tag-label")).toHaveCSS("color", "rgb(255, 255, 255)");
    await page.goto(frame("crew-tag-chip--plain"));
    await expect(page.getByTestId("tag-chip")).toHaveCSS("background-color", "rgb(232, 243, 250)");
    await page.goto(`${frame("crew-tag-chip--plain")}&theme=dark`);
    await expect(page.getByTestId("tag-chip")).toHaveCSS("background-color", "rgb(30, 41, 59)");
  });

  test("a Reanimated animation runs: its worklet, compiled by the Babel plugin, moves the ring", async ({
    page
  }) => {
    await page.goto(frame("controls-beacon-pulse--steady"));
    await isReady(page);
    const ring = page.getByTestId("beacon-ring");
    const opacity = async (): Promise<number> =>
      Number(await ring.evaluate((each) => getComputedStyle(each).opacity));
    const first = await opacity();
    await expect.poll(opacity).not.toBe(first);
    await expect(ring).toHaveCSS("transform", /^matrix\(/);
  });

  test("a native module a story stands in for answers; without one the component says so", async ({
    page
  }) => {
    await page.goto(frame("controls-battery-badge--charged"));
    await expect(page.getByTestId("battery")).toHaveText("Battery 82%");
    await page.goto(frame("controls-battery-badge--without-module"));
    await expect(page.getByTestId("battery")).toHaveText("Battery: no native module");
    // the stand-in is taken away with the story it served
    await page.goto(story("controls-battery-badge--low"));
    await expect(frameOf(page).getByTestId("battery")).toHaveText("Battery 7%");
    await page.getByLabel("Stories", { exact: true }).selectOption({ label: "Without module" });
    await expect(frameOf(page).getByTestId("battery")).toHaveText("Battery: no native module");
  });
});

test.describe("screens", () => {
  test("a full-screen story fills the frame as a screen fills a phone: its tab bar at the bottom", async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto(frame("screens-harbour--morning"));
    await isReady(page);
    const bar = await page.getByTestId("tab-bar").boundingBox();
    expect(bar === null ? 0 : Math.round(bar.y + bar.height)).toBe(700);
  });

  test("a centred story sits in the middle of its frame, the root leaving the canvas its room", async ({
    page
  }) => {
    await page.setViewportSize({ width: 600, height: 500 });
    await page.goto(frame("controls-icon-button--boat"));
    await isReady(page);
    const button = await page.getByRole("button", { name: "Boats" }).boundingBox();
    const canvas = await page.locator(".forgebook-frame").boundingBox();
    if (button === null || canvas === null) throw new Error("the story or its canvas is not drawn");
    expect(Math.round(button.x + button.width / 2)).toBe(Math.round(canvas.x + canvas.width / 2));
    expect(Math.round(button.y + button.height / 2)).toBe(Math.round(canvas.y + canvas.height / 2));
  });

  test("the shell shows a React Native story in light and dark, the story keeping its own colours", async ({
    page
  }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(story("crew-profile-card--online"));
      await expect(frameOf(page).getByText("Ada Brennan")).toBeVisible();
      await expect(frameOf(page).getByText("Ada Brennan")).toHaveCSS("color", "rgb(16, 33, 44)");
    }
  });
});

test.describe("agents", () => {
  test("the agent API reads a React Native story's args and its component's own props", async ({
    request
  }) => {
    const answer = await request.get("/__forgebook/api/story?id=stories:controls-icon-button--large-anchor");
    expect(answer.ok()).toBe(true);
    const body: unknown = await answer.json();
    expect(body).toMatchObject({
      story: { id: "stories:controls-icon-button--large-anchor" },
      args: { icon: "navigate", label: "Navigate", size: 40 },
      docs: { name: "IconButton" }
    });
    expect(JSON.stringify(body)).not.toContain("hitSlop");
  });
});
