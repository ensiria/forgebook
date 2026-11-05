/**
 * A Next.js project's components in the browser: the Next.js fixture (`fixtures/nextjs`), whose images, fonts, links,
 * routers, form, variables and server components draw outside Next.js through the same shell and frame as React's.
 *
 * @module
 */
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { test as base, expect, type FrameLocator, type Page } from "@playwright/test";

import { catalogueUrl } from "./ports";

/** The Next.js fixture's folder. */
const FIXTURE = join(import.meta.dirname, "..", "..", "nextjs");

/**
 * The tests, with story files they add to the fixture while its catalogue runs, removed when the test ends however it
 * ends: a `finally` in the test's body does not run after a timeout.
 */
const test = base.extend<{ addStoryFile: (file: string, text: string) => void }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads a fixture's dependencies from this parameter
  addStoryFile: async ({}, use) => {
    const added: string[] = [];
    await use((file: string, text: string): void => {
      added.push(file);
      writeFileSync(join(FIXTURE, file), text);
    });
    for (const file of added) rmSync(join(FIXTURE, file), { force: true });
  }
});

test.use({ baseURL: catalogueUrl("nextjs") });

/** Every story of the fixture that draws, by its id without the source. */
const STORY_IDS = [
  "site-navigation--home",
  "site-navigation--on-post",
  "site-navigation--goes-to-about",
  "site-hero--default",
  "site-hero--low-tide",
  "site-search--empty",
  "site-search--with-results",
  "blog-post-page--first-visit",
  "blog-post-page--returning-reader",
  "blog-latest-post--loaded"
];

/**
 * The shell's address of a story.
 *
 * @param id - the story's id without its source.
 */
const story = (id: string): string => `/?story=stories:${id}`;

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
 * Waits until a page's own story (a frame opened on its own) says what became of it.
 *
 * @param page - the frame's page.
 * @param status - the status it should reach.
 */
const reaches = async (page: Page, status: "ready" | "error"): Promise<void> => {
  await expect.poll(async () => page.locator("html").getAttribute("data-forgebook-status")).toBe(status);
};

test("every story is ready in its frame, without a page error and without asking Next.js's image server", async ({
  page
}) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));
  for (const id of STORY_IDS) {
    await page.goto(frame(id));
    await reaches(page, "ready");
  }
  expect(errors).toEqual([]);
  expect(requests.filter((url) => url.includes("/_next/"))).toEqual([]);
});

test.describe("images and fonts", () => {
  test("an imported image is drawn by Next.js's own component with its size, and one from public by its path", async ({
    page
  }) => {
    await page.goto(frame("site-hero--default"));
    await reaches(page, "ready");
    const hero = page.getByRole("img", { name: "The harbour at dawn" });
    await expect(hero).toHaveAttribute("width", "640");
    await expect(hero).toHaveAttribute("height", "320");
    // drawn as it is (Next.js's `unoptimized`): the file itself, Next.js's marker on the element
    await expect(hero).toHaveAttribute("data-nimg", "1");
    await expect(hero).toHaveAttribute("src", /harbour\.png$/);
    // Next.js's placeholder, then the image itself once it loaded
    await expect
      .poll(async () => hero.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth))
      .toBe(640);
    await page.goto(frame("site-navigation--home"));
    await expect(page.locator('img[src="/anchor.svg"]')).toHaveJSProperty("naturalWidth", 32);
  });

  test("a local font is loaded from the app's file, and a Google font gives its family and variable", async ({
    page
  }) => {
    await page.goto(frame("site-hero--default"));
    await reaches(page, "ready");
    const caption = page.locator("figcaption");
    await expect(caption).toHaveCSS("font-family", /__mono_\w+/);
    // the face is the app's file, served by the catalogue, and the browser loaded it for the caption
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          await document.fonts.ready;
          return [...document.fonts].some(
            (font) => font.family.includes("__mono_") && font.status === "loaded"
          );
        })
      )
      .toBe(true);
    // the fixture asks Google for nothing: Inter's class sets the family with its fallbacks
    const sans = await page.evaluate(() =>
      getComputedStyle(document.querySelector(".font-sans") ?? document.body).getPropertyValue("--font-sans")
    );
    expect(sans).toMatch(/^["']Inter["'], system-ui, sans-serif$/);
  });
});

test.describe("routes", () => {
  test("the current link follows the story's route, and a click moves it and is listed among the events", async ({
    page
  }) => {
    await page.goto(story("site-navigation--on-post"));
    const nav = frameOf(page).getByRole("navigation", { name: "Site" });
    await expect(nav.getByRole("link", { name: "Blog" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "About" }).click();
    await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Blog" })).not.toHaveAttribute("aria-current", "page");
    // the frame's own address never changes: it names the story
    expect(page.frames().some((each) => each.url().includes("/about"))).toBe(false);
    await page.getByRole("tab", { name: /Events/ }).click();
    await expect(page.getByText('router.push("/about")')).toBeVisible();
  });

  test("a play function clicks a link and reads the route it moved to", async ({ page }) => {
    await page.goto(story("site-navigation--goes-to-about"));
    await expect(page.getByRole("tab", { name: /Interactions/ })).toContainText("passed");
  });

  test("the search reads the story's search params, and a search moves them", async ({ page }) => {
    await page.goto(frame("site-search--with-results"));
    await reaches(page, "ready");
    await expect(page.getByRole("status")).toHaveText("Results for “tides”");
    await page.getByRole("textbox").fill("boats");
    await page.getByRole("button", { name: "Go" }).click();
    await expect(page.getByRole("status")).toHaveText("Results for “boats”");
  });
});

test.describe("server components and variables", () => {
  test("a server component's fetch of a full address is answered by the story's mock", async ({ page }) => {
    await page.goto(frame("blog-latest-post--loaded"));
    await expect(page.getByRole("heading", { name: "First light over the harbour" })).toBeVisible();
  });

  test("an async server component is awaited, reading the story's cookie", async ({ page }) => {
    await page.goto(frame("blog-post-page--returning-reader"));
    await reaches(page, "ready");
    await expect(page.getByRole("heading", { name: "First light on the pier" })).toBeVisible();
    await expect(page.getByText("Welcome back, Ada")).toBeVisible();
  });

  test("notFound() stops the story with what Next.js would have done", async ({ page }) => {
    await page.goto(frame("blog-post-page--missing"));
    await reaches(page, "error");
    await expect(
      page.getByText(/notFound\(\): in the app, Next.js would draw the not-found page/).first()
    ).toBeVisible();
  });

  test("the page has Next.js's public variables and next.config's env, and nothing else of the environment", async ({
    page
  }) => {
    await page.goto(frame("site-navigation--home"));
    await reaches(page, "ready");
    await expect(page.getByText("Harbour", { exact: true })).toBeVisible();
    const env = await page.evaluate(() => JSON.stringify(Reflect.get(globalThis, "process")));
    expect(env).toContain('"NEXT_PUBLIC_SITE_URL":"https://harbour.example"');
    expect(env).not.toContain("HARBOUR_DATABASE_PASSWORD");
    expect(env).not.toContain("invented-secret");
  });
});

test.describe("the story globs", () => {
  /**
   * The ids of the catalogue's components, as the agents' answers list them.
   *
   * @param page - a page of the catalogue.
   */
  const componentIds = async (page: Page): Promise<readonly string[]> => {
    const answer: unknown = await (await page.request.get("/__forgebook/api/stories")).json();
    const components: unknown =
      typeof answer === "object" && answer !== null ? Reflect.get(answer, "components") : undefined;
    return Array.isArray(components)
      ? components.map((component: unknown) =>
          typeof component === "object" && component !== null ? String(Reflect.get(component, "id")) : ""
        )
      : [];
  };

  test("a story file a `!` pattern leaves out is never listed, nor one added there while the catalogue runs", async ({
    page,
    addStoryFile
  }) => {
    await page.goto("/");
    const sidebar = page.getByRole("navigation", { name: "Components" });
    // the Site group counts its components: Hero, Navigation and Search, without the draft
    await expect(sidebar.getByRole("button", { name: "Site 3", exact: true })).toBeVisible();
    expect(await componentIds(page)).toContain("stories:site-navigation");
    expect(await componentIds(page)).not.toContain("stories:site-draft-banner");
    // a page that reloads loses this mark: a file no pattern lists changes no list, so nothing reloads
    await page.evaluate(() => Reflect.set(window, "forgebookKept", true));
    addStoryFile(
      "components/drafts/LaterBanner.stories.tsx",
      'export default { title: "Site/Later banner" };\nexport const Default = { render: () => "Later" };\n'
    );
    // the dev server sees a new file within a second; it must still be absent well after
    await page.waitForTimeout(2000);
    expect(await componentIds(page)).not.toContain("stories:site-later-banner");
    await expect(sidebar.getByRole("button", { name: "Site 3", exact: true })).toBeVisible();
    expect(await page.evaluate(() => Reflect.get(window, "forgebookKept"))).toBe(true);
  });
});
