/**
 * The catalogue on a phone's width, on the fixture app: the home, component pages, a story with its panel and docs pages
 * fit a 360 px window in both appearances, with what is wider than the window (a code block, a props table, a story
 * set wider than the stage) scrolling inside its own box and never the page.
 *
 * @module
 */
import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * How long a page waits for what the docs worker answers (the API reference): the run's first component page asks a
 * worker that has not built its TypeScript program yet.
 */
const DOCS_ANSWER = { timeout: 20_000 };

/** A page to open, and what shows once its widest parts are drawn. */
type NarrowPage = {
  /** The address. */
  path: string;
  /** What is on screen once the page is complete. */
  ready: (page: Page) => Locator;
};

/** The pages: the home, component pages with their API reference, a story and its panel, docs pages with blocks. */
const PAGES: readonly NarrowPage[] = [
  { path: "/", ready: (page) => page.locator(".forgebook-home__families").last() },
  {
    path: "/?component=kit:inputs-selection-select",
    ready: (page) => page.locator(".forgebook-api__subcomponent").first()
  },
  { path: "/?component=kit:layouts-form", ready: (page) => page.locator(".forgebook-example").first() },
  { path: "/?component=sb:components-button", ready: (page) => page.locator(".forgebook-api").first() },
  {
    path: "/?story=kit:inputs-selection-select--small",
    ready: (page) => page.locator(".forgebook-dock__body .forgebook-required-first")
  },
  { path: "/?page=kit:getting-started", ready: (page) => page.locator(".forgebook-docs__body pre").first() },
  {
    path: "/?page=kit:blocks",
    ready: (page) => page.locator(".forgebook-docs__body .forgebook-tabs").first()
  },
  { path: "/?page=sb:plugin-blocks", ready: (page) => page.locator(".forgebook-docs__body") }
];

/**
 * By how many pixels the widest of the page's own scrolling parts (the window, the main column's scroll, the panel's
 * body) overflows sideways: zero when nothing does.
 */
const sidewaysOverflow = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const scrollers = [
      document.documentElement,
      ...document.querySelectorAll(".forgebook-scroll, .forgebook-dock__body")
    ];
    return Math.max(...scrollers.map((element) => element.scrollWidth - element.clientWidth));
  });

test.describe("a phone's width", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const { path, ready } of PAGES) {
      test(`${path} never scrolls sideways at 360 px (${colorScheme})`, async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 700 });
        await page.emulateMedia({ colorScheme });
        await page.goto(path);
        await page.getByRole("button", { name: "Hide the sidebar" }).click();
        await expect(ready(page)).toBeVisible(DOCS_ANSWER);
        await expect.poll(() => sidewaysOverflow(page)).toBeLessThanOrEqual(0);
      });
    }
  }
});
