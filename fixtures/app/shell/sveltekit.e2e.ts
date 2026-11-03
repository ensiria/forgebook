/**
 * A SvelteKit app's components in the browser: the SvelteKit fixture, whose components read `$app/state`, move with
 * `goto` and links, submit enhanced forms and load their page's data, in frames that never leave their story.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

import { catalogueUrl } from "./ports";

test.use({ baseURL: catalogueUrl("sveltekit") });

/** Every story of the fixture that draws, by its id without the source. */
const STORY_IDS = [
  "layout-site-nav--default",
  "layout-site-nav--on-about",
  "layout-site-nav--follows-link",
  "layout-site-nav--handled-link",
  "navigation-search-box--with-query",
  "navigation-search-box--searches",
  "pages-post--loaded",
  "pages-post--from-data",
  "pages-account--signs-in",
  "pages-account--refused"
];

/** The value of the fixture's private variable, which no answer of the catalogue may hold. */
const SECRET = "never-in-a-page";

/** The address of a story. */
const story = (id: string, query = ""): string => `/?story=sveltekit:${id}${query === "" ? "" : `&${query}`}`;

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/** Waits until the shown story's frame says it is ready. */
const isReady = async (page: Page): Promise<void> => {
  await expect(page.locator("iframe.forgebook-frame-view")).toBeVisible();
  await expect
    .poll(async () => frameOf(page).locator("html").getAttribute("data-forgebook-status"))
    .toBe("ready");
};

test("every SvelteKit story is ready in its frame, its address unchanged, without a page error or React", async ({
  page
}) => {
  const errors: string[] = [];
  const scripts: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => scripts.push(response.url()));
  for (const id of STORY_IDS) {
    const address = `/frame.html?story=sveltekit:${id}`;
    await page.goto(address);
    await expect
      .poll(async () => page.locator("html").getAttribute("data-forgebook-status"), { message: id })
      .toBe("ready");
    // a play that clicked a link or sent a form moved the story's page, never the frame
    expect(new URL(page.url()).search).toBe(`?story=sveltekit:${id}`);
  }
  expect(errors).toEqual([]);
  expect(scripts.filter((url) => /react(?!iv)/.test(url))).toEqual([]);
});

test.describe("the page a story is on", () => {
  test("a component reads the story's page, the public environment and the app's version", async ({
    page
  }) => {
    await page.goto("/frame.html?story=sveltekit:layout-site-nav--on-about");
    await expect(page.getByRole("link", { name: /About/ })).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("site-name")).toHaveText("Forgebook Kit fixture");
    await expect(page.getByTestId("version")).toHaveText("v1.4.0");
  });

  test("a link clicked moves the story's page, and the catalogue lists it among its events", async ({
    page
  }) => {
    await page.goto(story("layout-site-nav--follows-link", "tab=events"));
    await isReady(page);
    await expect(frameOf(page).getByRole("link", { name: /First post/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(page.locator(".forgebook-calls__item")).toContainText(["link"]);
    await expect(page.locator(".forgebook-calls__item").first()).toContainText("/blog/hello-world");
  });

  test("a link an hrefs entry handles leaves the page where it is", async ({ page }) => {
    await page.goto("/frame.html?story=sveltekit:layout-site-nav--handled-link");
    await expect(page.locator("html")).toHaveAttribute("data-forgebook-status", "ready");
    await expect(page.getByRole("link", { name: /Home/ })).toHaveAttribute("aria-current", "page");
  });

  test("goto moves the page, and afterNavigate saw the page drawn and the move", async ({ page }) => {
    await page.goto(story("navigation-search-box--searches", "tab=events"));
    await isReady(page);
    await expect(frameOf(page).getByTestId("query")).toHaveText("Query: svelte");
    await expect(frameOf(page).getByTestId("navigations")).toHaveText("Navigations: 2");
    await expect(page.locator(".forgebook-calls__item")).toContainText(["goto"]);
  });
});

test.describe("a page's data and forms", () => {
  test("a page's load runs with the story's params, its fetch answered by the story's mock", async ({
    page
  }) => {
    await page.goto("/frame.html?story=sveltekit:pages-post--loaded");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Post hello-world");
    await expect(page.getByTestId("slug")).toHaveText("Slug: hello-world");
  });

  test("a page's data given by the story is its data prop", async ({ page }) => {
    await page.goto("/frame.html?story=sveltekit:pages-post--from-data");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("A given post");
  });

  test("an enhanced form is answered by the story's result, the page's form and status following", async ({
    page
  }) => {
    await page.goto(story("pages-account--refused", "tab=events"));
    await isReady(page);
    await expect(frameOf(page).getByTestId("answer")).toHaveText("An email is needed (400)");
    await expect(page.locator(".forgebook-calls__item")).toContainText(["enhance"]);
    await page.goto("/frame.html?story=sveltekit:pages-account--signs-in");
    await expect(page.getByTestId("answer")).toHaveText("Signed in as ada@example.com (200)");
  });
});

test("a component that reads a private variable fails with why, and the secret never reaches the page", async ({
  page
}) => {
  const bodies: Promise<string>[] = [];
  page.on("response", (response) => {
    bodies.push(response.text().catch(() => ""));
  });
  await page.goto(story("states-secret-reader--refused"));
  await expect(frameOf(page).locator("body")).toContainText("$app/env/private is the private environment");
  expect((await Promise.all(bodies)).filter((body) => body.includes(SECRET))).toEqual([]);
});
