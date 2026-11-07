/**
 * The catalogue on a phone's width, on the fixture app: the home, component pages, a story with its panel and docs pages
 * fit a 360 px window in both appearances, with what is wider than the window (a code block, a props table, a story
 * set wider than the stage) scrolling inside its own box and never the page; there the sidebar slides over the page,
 * and a wide window keeps it beside the page.
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
        await expect(ready(page)).toBeVisible(DOCS_ANSWER);
        await expect.poll(() => sidewaysOverflow(page)).toBeLessThanOrEqual(0);
      });
    }
  }
});

/** The phone's window every test of the sidebar's overlay opens. */
const PHONE = { width: 360, height: 700 };

/** A story to open, with its stage behind the sidebar. */
const STORY = "/?story=kit:inputs-selection-select--small";

/** The sidebar. */
const sidebarOf = (page: Page): Locator => page.locator(".forgebook-sidebar");

/** The page beside or behind the sidebar. */
const mainOf = (page: Page): Locator => page.locator(".forgebook-main");

/** The button that shows a hidden sidebar. */
const toggleOf = (page: Page): Locator => page.getByRole("button", { name: "Show the sidebar" });

/** The shade over the page. */
const shadeOf = (page: Page): Locator => page.locator(".forgebook-sidebar-shade");

/** Shows the sidebar on a phone's window, and waits for it to arrive. */
const openSidebar = async (page: Page): Promise<void> => {
  await toggleOf(page).click();
  await expect(sidebarOf(page)).toBeInViewport({ ratio: 1 });
};

/** The sidebar is out of sight and out of reach, and the page can be reached again with the focus on the toggle. */
const expectClosed = async (page: Page): Promise<void> => {
  await expect(sidebarOf(page)).toHaveAttribute("inert");
  await expect(sidebarOf(page)).not.toBeInViewport();
  await expect(mainOf(page)).not.toHaveAttribute("inert");
  await expect(shadeOf(page)).toBeHidden();
  await expect(toggleOf(page)).toBeFocused();
};

/** The width of the page's column, in CSS px. */
const mainWidth = (page: Page): Promise<number> =>
  mainOf(page).evaluate((element) => element.getBoundingClientRect().width);

test.describe("the sidebar on a phone's width", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
  });

  test("starts closed, the page taking the whole window", async ({ page }) => {
    await page.goto(STORY);
    await expect(sidebarOf(page)).toHaveAttribute("inert");
    await expect(sidebarOf(page)).not.toBeInViewport();
    await expect(toggleOf(page)).toBeVisible();
    await expect(page.getByRole("separator", { name: "Sidebar width" })).toHaveCount(0);
    expect(await mainWidth(page)).toBe(PHONE.width);
  });

  test("opens over the page without shrinking it, the focus in it and the page out of reach", async ({
    page
  }) => {
    await page.goto(STORY);
    await openSidebar(page);
    expect(await mainWidth(page)).toBe(PHONE.width);
    await expect(page.getByRole("separator", { name: "Sidebar width" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Hide the sidebar" })).toBeFocused();
    await expect(mainOf(page)).toHaveAttribute("inert");
    await expect(shadeOf(page)).toBeVisible();
    await expect.poll(() => sidewaysOverflow(page)).toBeLessThanOrEqual(0);
    await expect.poll(() => page.evaluate(() => window.scrollX)).toBe(0);
    // Tab goes past the sidebar's end into the browser's own controls, and the page takes no focus even when asked
    for (let press = 0; press < 60; press += 1) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.closest(".forgebook-main") === null)).toBe(
        true
      );
    }
    await toggleOf(page).evaluate((button) => button.focus());
    await expect(toggleOf(page)).not.toBeFocused();
  });

  test("a tap outside closes it, without reaching the page behind", async ({ page }) => {
    await page.goto(STORY);
    const address = page.url();
    await openSidebar(page);
    // on the toolbar, under the shade: reaching the page would press what is there
    await page.mouse.click(PHONE.width - 8, 20);
    await expectClosed(page);
    expect(page.url()).toBe(address);
  });

  test("Escape closes it, wherever the focus is", async ({ page }) => {
    await page.goto(STORY);
    await openSidebar(page);
    await page.keyboard.press("Escape");
    await expectClosed(page);
    await openSidebar(page);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.keyboard.press("Escape");
    await expectClosed(page);
  });

  test("its own button closes it", async ({ page }) => {
    await page.goto(STORY);
    await openSidebar(page);
    await page.getByRole("button", { name: "Hide the sidebar" }).click();
    await expectClosed(page);
  });

  test("Escape empties the search first, and leaves an open menu's closing to the menu", async ({ page }) => {
    await page.goto("/");
    await openSidebar(page);
    const search = page.getByRole("searchbox");
    await search.fill("value");
    await page.keyboard.press("Escape");
    await expect(search).toHaveValue("");
    await expect(sidebarOf(page)).not.toHaveAttribute("inert");
    await page.keyboard.press("Escape");
    await expectClosed(page);

    await openSidebar(page);
    const menu = page.locator(".forgebook-appearance").getByRole("button");
    await menu.click();
    await expect(page.getByRole("dialog", { name: "Interface" })).toBeInViewport({ ratio: 1 });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Interface" })).toHaveCount(0);
    await expect(sidebarOf(page)).not.toHaveAttribute("inert");
    await expect(menu).toBeFocused();
    await page.keyboard.press("Escape");
    await expectClosed(page);
  });

  test("picking a component closes it, even the one already shown", async ({ page }) => {
    await page.goto(STORY);
    await openSidebar(page);
    const shown = sidebarOf(page).locator(".forgebook-tree__item[aria-current]");
    await shown.click();
    await expectClosed(page);

    await openSidebar(page);
    await sidebarOf(page)
      .locator(".forgebook-tree__item:not([aria-current]) >> visible=true")
      .first()
      .click();
    await expectClosed(page);
    await expect(page).not.toHaveURL(/inputs-selection-select--small/);
  });

  test("picking a docs page or the logo closes it", async ({ page }) => {
    await page.goto(STORY);
    await openSidebar(page);
    await sidebarOf(page).getByRole("link", { name: "Getting started" }).click();
    await expect(page).toHaveURL(/getting-started/);
    await expectClosed(page);
    await openSidebar(page);
    await page.locator(".forgebook-brand__home").click();
    await expect(page.locator(".forgebook-home__families").last()).toBeVisible();
    // the home has a toolbar of its own, and the focus finds the new toggle
    await expectClosed(page);
  });

  test("a search's result closes it", async ({ page }) => {
    await page.goto("/");
    await openSidebar(page);
    await page.getByRole("searchbox").fill("value");
    await page.locator(".forgebook-search-panel a").first().click();
    await expect(page).not.toHaveURL(/\/$/);
    await expect(sidebarOf(page)).toHaveAttribute("inert");
    await expect(sidebarOf(page)).not.toBeInViewport();
    await expect(mainOf(page)).not.toHaveAttribute("inert");
  });

  test("a search's result keeps the focus on what it found", async ({ page }) => {
    await page.goto("/");
    await openSidebar(page);
    await page.getByRole("searchbox").fill("value");
    await page.locator(".forgebook-search-panel a", { hasText: "Called with the new value" }).click();
    await expect(page).toHaveURL(/prop\.onValueChange/);
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest(".forgebook-main") !== null))
      .toBe(true);
    await expect(toggleOf(page)).not.toBeFocused();
  });

  test("the story keys and the history close it: the page it covered changes", async ({ page }) => {
    await page.goto(STORY);
    await openSidebar(page);
    await page.keyboard.press("]");
    await expect(page).not.toHaveURL(/inputs-selection-select--small/);
    await expectClosed(page);
    await openSidebar(page);
    await page.goBack();
    await expect(page).toHaveURL(/inputs-selection-select--small/);
    await expectClosed(page);
  });

  test("the search key opens it with the focus on the field", async ({ page }) => {
    await page.goto(STORY);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(sidebarOf(page)).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("searchbox")).toBeFocused();
    await expect(mainOf(page)).toHaveAttribute("inert");
  });

  test("slides, and appears at once for a person who asked for less motion", async ({ page }) => {
    const durations = (selector: string): Promise<string> =>
      page.locator(selector).evaluate((element) => getComputedStyle(element).transitionDuration);
    await page.goto(STORY);
    expect(await durations(".forgebook-sidebar")).not.toBe("0s");
    expect(await durations(".forgebook-sidebar-shade")).not.toBe("0s");
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await durations(".forgebook-sidebar")).toBe("0s");
    expect(await durations(".forgebook-sidebar-shade")).toBe("0s");
  });

  test("a width kept from a wide window leaves room to tap outside", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto(STORY);
    await page.getByRole("separator", { name: "Sidebar width" }).focus();
    for (let press = 0; press < 16; press += 1) await page.keyboard.press("ArrowRight");
    await page.setViewportSize(PHONE);
    await openSidebar(page);
    const box = await sidebarOf(page).boundingBox();
    expect(box?.width ?? PHONE.width).toBeLessThanOrEqual(PHONE.width - 32);
    await page.mouse.click(PHONE.width - 8, 300);
    await expectClosed(page);
    await page.setViewportSize({ width: 1440, height: 800 });
    await expect(sidebarOf(page)).toBeInViewport({ ratio: 1 });
    await expect(sidebarOf(page)).toHaveJSProperty("offsetWidth", 448);
  });

  test("an embed has no sidebar and no shade", async ({ page }) => {
    await page.goto("/?embed&story=kit:inputs-selection-select--small");
    await expect(page.frameLocator("iframe").locator("body")).toBeVisible();
    await expect(sidebarOf(page)).toHaveCount(0);
    await expect(shadeOf(page)).toHaveCount(0);
    await expect(toggleOf(page)).toHaveCount(0);
  });
});

test.describe("the sidebar on a touch screen's width", () => {
  test.use({ hasTouch: true, viewport: PHONE });

  for (const touch of ["off", "touch"] as const) {
    test(`a tap outside closes it and a picked component too, with Touch ${touch}`, async ({ page }) => {
      await page.goto(`${STORY}&touch=${touch}`);
      await page.frameLocator("iframe").locator("body").waitFor();
      await toggleOf(page).tap();
      await expect(sidebarOf(page)).toBeInViewport({ ratio: 1 });
      await page.touchscreen.tap(PHONE.width - 8, 300);
      await expect(sidebarOf(page)).not.toBeInViewport();
      await expect(mainOf(page)).not.toHaveAttribute("inert");

      await toggleOf(page).tap();
      await expect(sidebarOf(page)).toBeInViewport({ ratio: 1 });
      await sidebarOf(page).locator(".forgebook-tree__item[aria-current]").tap();
      await expect(sidebarOf(page)).not.toBeInViewport();
      await expect(toggleOf(page)).toBeFocused();
    });
  }
});

test.describe("the sidebar across widths", () => {
  test("the focus never falls out of a sidebar going away as the window crosses the width", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto(STORY);
    await page.getByRole("button", { name: "Hide the sidebar" }).focus();
    await page.setViewportSize(PHONE);
    await expect(toggleOf(page)).toBeFocused();

    // over the page with the wide choice hidden: widening hides it, and the focus comes out of it
    await toggleOf(page).click();
    await expect(sidebarOf(page)).toBeInViewport({ ratio: 1 });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.getByRole("button", { name: "Hide the sidebar" }).click();
    await page.setViewportSize(PHONE);
    await openSidebar(page);
    await page.setViewportSize({ width: 1440, height: 800 });
    await expect(sidebarOf(page)).toHaveAttribute("inert");
    await expect(toggleOf(page)).toBeFocused();
  });

  test("what a person chose on a wide window survives a narrow one, shown or hidden", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto(STORY);
    const hide = page.getByRole("button", { name: "Hide the sidebar" });
    await expect(sidebarOf(page)).toBeInViewport({ ratio: 1 });

    // shown on the wide window: closed on the narrow one, opened and closed there, shown again when wide
    await page.setViewportSize(PHONE);
    await expect(sidebarOf(page)).toHaveAttribute("inert");
    await openSidebar(page);
    await page.keyboard.press("Escape");
    await expectClosed(page);
    await page.setViewportSize({ width: 1440, height: 800 });
    await expect(sidebarOf(page)).toBeInViewport({ ratio: 1 });
    await page.reload();
    await expect(sidebarOf(page)).toBeInViewport({ ratio: 1 });

    // hidden on the wide window: opened on the narrow one, and left open as the window widens, hidden again
    await hide.click();
    await page.setViewportSize(PHONE);
    await openSidebar(page);
    await page.setViewportSize({ width: 1440, height: 800 });
    await expect(sidebarOf(page)).toHaveAttribute("inert");
    await expect(mainOf(page)).not.toHaveAttribute("inert");
    await page.reload();
    await expect(sidebarOf(page)).toHaveAttribute("inert");

    // an overlay left open does not come back open by itself
    await toggleOf(page).click();
    await page.setViewportSize(PHONE);
    await expect(sidebarOf(page)).toHaveAttribute("inert");
    await expect(mainOf(page)).not.toHaveAttribute("inert");
  });

  test("the appearance menu is whole inside the sidebar, however narrow the sidebar is", async ({ page }) => {
    // read once it stands still: while it grows in it is narrower, and whole at some moment even when it ends up cut
    const expectWholeMenu = async (): Promise<void> => {
      await page.locator(".forgebook-appearance").getByRole("button").click();
      const menu = page.getByRole("dialog", { name: "Interface" });
      await menu.evaluate((panel) =>
        Promise.all(panel.getAnimations().map((animation) => animation.finished))
      );
      await expect(menu).toBeInViewport({ ratio: 1 });
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
    };

    await page.setViewportSize(PHONE);
    await page.goto(STORY);
    await openSidebar(page);
    await expectWholeMenu();

    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto(STORY);
    await expectWholeMenu();
    const handle = page.getByRole("separator", { name: "Sidebar width" });
    await handle.focus();
    for (let step = 0; step < 4; step += 1) await page.keyboard.press("ArrowLeft");
    await expect(sidebarOf(page)).toHaveCSS("width", "192px");
    await expectWholeMenu();
  });

  test("a wide window keeps it beside the page: no shade, nothing inert, a pick leaves it open", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto(STORY);
    const sidebar = sidebarOf(page);
    await expect(sidebar).toHaveCSS("position", "sticky");
    await expect(sidebar).not.toHaveAttribute("data-overlay");
    await expect(shadeOf(page)).toHaveCount(0);
    await expect(mainOf(page)).not.toHaveAttribute("inert");
    await expect(page.getByRole("separator", { name: "Sidebar width" })).toBeVisible();
    await expect(toggleOf(page)).toHaveCount(0);
    // the sidebar's default width: its handle lies on the sidebar's edge and takes no room of its own
    const main = await mainOf(page).boundingBox();
    expect(main?.x).toBe(248);
    expect(main?.width).toBe(1192);

    await page.keyboard.press("Escape");
    await expect(sidebar).not.toHaveAttribute("inert");
    await sidebar.locator(".forgebook-tree__item:not([aria-current]) >> visible=true").first().click();
    await expect(page).not.toHaveURL(/inputs-selection-select--small/);
    await expect(sidebar).not.toHaveAttribute("inert");

    // hiding it still gives the page its room, and showing it takes it back
    await page.getByRole("button", { name: "Hide the sidebar" }).click();
    await expect(sidebar).not.toBeInViewport();
    await expect.poll(() => mainWidth(page)).toBe(1440);
    await toggleOf(page).click();
    await expect(sidebar).toBeInViewport({ ratio: 1 });
  });
});
