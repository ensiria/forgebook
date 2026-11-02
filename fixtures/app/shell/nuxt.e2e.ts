/**
 * A Nuxt project's components in the browser: the Nuxt fixture, whose components use Nuxt's auto-imports, aliases,
 * router, data, state and config, drawn by the same shell and frame, each story given its own Nuxt.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

import { NUXT_PORT } from "./ports";

test.use({ baseURL: `http://127.0.0.1:${NUXT_PORT}/` });

/** Every story of the fixture, by its id without the source. */
const STORY_IDS = [
  "layout-site-nav--home",
  "layout-site-nav--on-post",
  "layout-site-nav--goes-to-about",
  "layout-site-header--default",
  "layout-site-header--other-site",
  "blog-blog-post--from-story-data",
  "blog-blog-post--from-request",
  "blog-blog-post--missing",
  "shop-product-list--from-request",
  "shop-product-list--from-story-data",
  "shop-product-list--other-api",
  "shop-cart-button--empty",
  "shop-cart-button--with-items"
];

/** The address of a story. */
const story = (id: string, query = ""): string => `/?story=nuxt:${id}${query === "" ? "" : `&${query}`}`;

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/** Waits until the shown story's frame says it is ready. */
const isReady = async (page: Page): Promise<void> => {
  await expect(page.locator("iframe.forgebook-frame-view")).toBeVisible();
  await expect
    .poll(async () => frameOf(page).locator("html").getAttribute("data-forgebook-status"))
    .toBe("ready");
};

test("every Nuxt story is ready in its frame, its play passing, without a page error or React", async ({
  page
}) => {
  const errors: string[] = [];
  const scripts: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => scripts.push(response.url()));
  for (const id of STORY_IDS) {
    await page.goto(`/frame.html?story=nuxt:${id}`);
    await expect
      .poll(async () => page.locator("html").getAttribute("data-forgebook-status"), { message: id })
      .toBe("ready");
  }
  expect(errors).toEqual([]);
  expect(scripts.filter((url) => /react|server-renderer/.test(url))).toEqual([]);
});

test.describe("what a Nuxt component finds", () => {
  test("its route, set by the story by a page's name, and the project's style sheet", async ({ page }) => {
    await page.goto("/frame.html?story=nuxt:layout-site-nav--on-post");
    await expect(page.getByTestId("path")).toHaveText("On /blog/hello-world");
    const active = page.getByRole("link", { name: "First post" });
    await expect(active).toHaveClass(/router-link-exact-active/);
    // `nuxt.config`'s `css` marks the active link
    await expect(active).toHaveCSS("font-weight", "700");
  });

  test("the app config merged from nuxt.config and app.config, and the story's runtime config", async ({
    page
  }) => {
    await page.goto("/frame.html?story=nuxt:layout-site-header--default");
    const header = page.locator("header");
    await expect(header).toHaveAttribute("data-accent", "teal");
    await expect(header).toHaveAttribute("data-radius", "8px");
    await expect(header).toContainText("Welcome to Forge Shop, Ada");
    await expect(header).toContainText("Free shipping over €50.00");
    await page.goto("/frame.html?story=nuxt:layout-site-header--other-site");
    await expect(page.locator("header")).toContainText("Welcome to Forge Outlet, Ada");
  });

  test("the data a story gives without a request, and a request MSW answers", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(new URL(request.url()).pathname));
    await page.goto("/frame.html?story=nuxt:blog-blog-post--from-story-data");
    await expect(page.getByRole("heading", { name: "Hello from the story" })).toBeVisible();
    expect(requests).not.toContain("/api/posts/hello-world");
    await page.goto("/frame.html?story=nuxt:shop-product-list--from-request");
    await expect(page.getByText("Hammer: €24.50")).toBeVisible();
    await page.goto("/frame.html?story=nuxt:blog-blog-post--missing");
    await expect(page.getByRole("alert")).toHaveText("The post could not be loaded (404)");
  });

  test("never the project's private runtime config", async ({ page }) => {
    const bodies: string[] = [];
    page.on("response", async (response) => {
      if (response.request().resourceType() === "script") bodies.push(await response.text().catch(() => ""));
    });
    await page.goto("/frame.html?story=nuxt:layout-site-header--default");
    await expect(page.locator("header")).toBeVisible();
    expect(bodies.some((body) => body.includes("server-only-value"))).toBe(false);
  });
});

test.describe("the panel on a Nuxt story", () => {
  test("lists the router's moves among the events, and the play's route", async ({ page }) => {
    await page.goto(story("layout-site-nav--home", "tab=events"));
    await isReady(page);
    await frameOf(page).getByRole("link", { name: "About" }).click();
    await expect(frameOf(page).getByTestId("path")).toHaveText("On /about");
    await expect(page.locator(".forgebook-calls__item")).toContainText(["router.push"]);
  });

  test("records a link out of the site instead of leaving the frame", async ({ page }) => {
    await page.goto(story("layout-site-nav--home", "tab=events"));
    await isReady(page);
    await frameOf(page).getByRole("link", { name: "Nuxt" }).click();
    await expect(page.locator(".forgebook-calls__item")).toContainText(["navigateTo"]);
    await expect(frameOf(page).getByTestId("path")).toHaveText("On /");
    expect(page.context().pages()).toHaveLength(1);
  });

  test("records the navigateTo a button calls, with where it went", async ({ page }) => {
    await page.goto(story("shop-cart-button--empty", "tab=events"));
    await isReady(page);
    await frameOf(page).getByRole("button", { name: "Checkout" }).click();
    await expect(page.locator(".forgebook-calls__item")).toContainText(["navigateTo"]);
    await expect(page.locator(".forgebook-calls__item")).toContainText(["/checkout?items=0"]);
  });
});
