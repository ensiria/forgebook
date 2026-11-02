/**
 * The catalogue's shell in the browser, on the fixture app: pages and the address, the scroll position from page to
 * page, the story picker and the keys, the stage's width and zoom, the live view, the panel's tabs, a story that
 * throws, and the compare view.
 *
 * @module
 */

import { findOverlaysPastFrame } from "@forgebook/testing/overlays";
import { expect, type FrameLocator, type Locator, type Page, test } from "@playwright/test";

/** The address of a story of the fixture's Select. */
const story = (name: string, query = ""): string =>
  `/?story=kit:inputs-selection-select--${name}${query === "" ? "" : `&${query}`}`;

/** The sidebar's tree, where each component has its link: the header may link the same names (related pages). */
const sidebarLinks = (page: Page): Locator => page.getByRole("navigation", { name: "Components" });

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/** Waits until what a locator finds has finished moving in: a press with `force` would land on a moving part. */
const settled = async (parts: Locator): Promise<void> => {
  await parts.evaluateAll((elements) =>
    Promise.all(elements.flatMap((element) => element.getAnimations().map((each) => each.finished)))
  );
};

/**
 * Opens the View menu: its panel loads on the first press, so the press is over once the panel is there.
 *
 * @param page - the catalogue's page.
 */
const clickView = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: /^View/ }).click();
  await expect(page.getByRole("dialog", { name: "View" })).toBeVisible();
};

/** Waits until the open popovers have finished growing in. */
const popoversSettled = (page: Page): Promise<void> => settled(page.locator(".forgebook-popover"));

/** Waits until the shown story's frame says it is ready (or failed). */
const frameStatus = async (page: Page): Promise<string | null> => {
  const html = page.locator("iframe.forgebook-frame-view");
  await expect(html).toBeVisible();
  await expect
    .poll(async () => frameOf(page).locator("html").getAttribute("data-forgebook-status"))
    .not.toBeNull();
  return frameOf(page).locator("html").getAttribute("data-forgebook-status");
};

test.describe("pages and the address", () => {
  test("opens the home when the address names none: the library's introduction and its families", async ({
    page
  }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Fixture catalogue");
    const library = page.getByRole("region", { name: "Fixture kit" });
    await expect(library.locator(".forgebook-prose")).toContainText("a library says here what it is");
    await expect(library.locator(".forgebook-prose h1")).toHaveCount(0);
    await expect(library.locator(".forgebook-prose .forgebook-hl-keyword").first()).toHaveText("import");
    await expect(library.getByRole("article", { name: "Inputs" })).toContainText("Select");
    // the library's own logo beside its name, on the home and in the sidebar
    for (const logo of [
      page.locator("#forgebook-source-kit img"),
      page.locator(".forgebook-tree__source-name img")
    ]) {
      await expect
        .poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
    }
    await library.getByRole("link", { name: "Select", exact: true }).click();
    await expect(page).toHaveURL(/component=kit%3Ainputs-selection-select/);
  });

  test("the logo goes home, which lists the pages opened last", async ({ page }) => {
    await page.goto(story("small"));
    await frameStatus(page);
    // the logo the catalogue's owner gave: in the sidebar and as the page's icon
    const logo = page.locator(".forgebook-brand__logo");
    await expect
      .poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
      "href",
      (await logo.getAttribute("src")) ?? ""
    );
    await page.getByRole("link", { name: "Fixture catalogue", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Fixture catalogue", exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    );
    const recent = page.getByRole("region", { name: "Recently opened" });
    await expect(recent.getByRole("link")).toHaveText([/^Small/]);
    await recent.getByRole("link").first().click();
    await expect(page).toHaveURL(/select--small/);
  });

  test("says so when the address names a story that is not there, and never opens another", async ({
    page
  }) => {
    await page.goto("/?story=kit:inputs-selection-select--renamed");
    await expect(page.getByRole("alert")).toContainText('No story "kit:inputs-selection-select--renamed"');
    await expect(page.locator("iframe")).toHaveCount(0);
  });

  test("the picker and ] open the component's stories, by group, in the address", async ({ page }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    await page.getByLabel("Stories", { exact: true }).selectOption({ label: "Small" });
    await expect(page).toHaveURL(/select--small/);
    // by group, not by the file: Hinted, the other state, comes before In row, which the file writes between them
    await page.locator("body").press("]");
    await expect(page).toHaveURL(/select--hinted/);
    await page.locator("body").press("]");
    await expect(page).toHaveURL(/select--in-row/);
  });
});

test.describe("a catalogue's theme of the shell", () => {
  test("reaches what the shell draws, each palette in its appearance, and stays out of the frames", async ({
    page
  }) => {
    await page.goto("/?component=kit%3Ainputs-selection-select");
    await expect(page.locator("iframe.forgebook-frame-view").first()).toBeVisible();
    const custom = (name: string): Promise<string> =>
      page.evaluate(
        (property) => getComputedStyle(document.documentElement).getPropertyValue(property).trim(),
        name
      );
    const appearance = (value: string): Promise<void> =>
      page.evaluate(
        (next) => document.documentElement.setAttribute("data-forgebook-appearance", next),
        value
      );
    await appearance("light");
    await expect.poll(() => custom("--forgebook-accent-text")).toBe("#5a2aa0");
    await expect(page.locator(".forgebook-example__box").first()).toHaveCSS("border-radius", "10px");

    await appearance("dark");
    await expect.poll(() => custom("--forgebook-accent")).toBe("#b28bff");
    // a role only the light palette sets keeps the shell's own colour in dark
    await expect.poll(() => custom("--forgebook-accent-text")).toBe("#7ab3ff");

    const inFrame = await page
      .frameLocator("iframe.forgebook-frame-view")
      .first()
      .locator(".forgebook-frame")
      .evaluate((root) => getComputedStyle(root).getPropertyValue("--forgebook-radius-card"));
    expect(inFrame.trim()).toBe("12px");
  });
});

test.describe("the shell following the story", () => {
  test("turns dark with the story, stays while comparing, and yields to the reader's own choice", async ({
    page
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(story("overview", "theme=dark"));
    const appearance = (): Promise<string | null> =>
      page.evaluate(() => document.documentElement.getAttribute("data-forgebook-appearance"));
    await expect.poll(appearance).toBe("light");

    await page.getByRole("button", { name: /^Appearance/ }).click();
    await page
      .getByRole("dialog", { name: "Appearance" })
      .getByRole("radio", { name: "Follow the story" })
      .check();
    await expect.poll(appearance).toBe("dark");

    await page.goto(story("overview", "theme=dark&compare=theme"));
    await expect.poll(appearance).toBe("light");

    await page.goto(story("overview", "theme=dark"));
    await expect.poll(appearance).toBe("dark");
    await page.getByRole("button", { name: /^Appearance/ }).click();
    await page.getByRole("dialog", { name: "Appearance" }).getByRole("radio", { name: "Light" }).check();
    await expect.poll(appearance).toBe("light");
  });
});

test.describe("the scroll position", () => {
  /** The shown page's scrolling part. */
  const scroller = (page: Page): Locator => page.locator("main .forgebook-scroll");

  /** Where the shown page stands. */
  const offsetOf = (page: Page): Promise<number> => scroller(page).evaluate((element) => element.scrollTop);

  /** Scrolls the shown page down the way a wheel does, and returns where it stopped once it stays there. */
  const scrollDown = async (page: Page): Promise<number> => {
    const box = await scroller(page).boundingBox();
    if (box === null) throw new Error("The page has no scrolling part");
    // near its top: the shell's own content (the story's bar, the page's lead), never a story's frame
    await page.mouse.move(box.x + box.width / 2, box.y + 12);
    await page.mouse.wheel(0, 120);
    let last = -1;
    await expect
      .poll(async () => {
        const now = await offsetOf(page);
        const isStill = now === last && now > 0;
        last = now;
        return isStill;
      })
      .toBe(true);
    return last;
  };

  test("back gives a page its own position; a page opened anew starts at its top", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 400 });
    await page.goto("/?component=kit:inputs-selection-select");
    await expect(page.locator(".forgebook-doc__lead")).toBeVisible();
    const offset = await scrollDown(page);
    await page.getByRole("button", { name: /^Foundations/ }).click();
    await sidebarLinks(page).getByRole("link", { name: /^Page/ }).click();
    await expect(page).toHaveURL(/component=kit%3Afoundations-page/);
    await expect(scroller(page)).toHaveJSProperty("scrollTop", 0);
    await page.goBack();
    await expect(page).toHaveURL(/component=kit(:|%3A)inputs-selection-select/);
    await expect.poll(() => offsetOf(page)).toBe(offset);
    // the same page opened again from the sidebar is a new visit: its top, not the last position
    await sidebarLinks(page).getByRole("link", { name: /^Page/ }).click();
    await expect(page).toHaveURL(/component=kit%3Afoundations-page/);
    await sidebarLinks(page)
      .getByRole("link", { name: /^Select/ })
      .click();
    await expect(page).toHaveURL(/component=kit%3Ainputs-selection-select/);
    await expect(page.locator(".forgebook-doc__lead")).toBeVisible();
    await expect(scroller(page)).toHaveJSProperty("scrollTop", 0);
  });

  test("another story of the component opens at its top", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(story("overview"));
    await frameStatus(page);
    await scrollDown(page);
    await page.getByLabel("Stories", { exact: true }).selectOption({ label: "Small" });
    await expect(page).toHaveURL(/select--small/);
    await frameStatus(page);
    // the new story could keep the offset: its page scrolls too
    expect(
      await scroller(page).evaluate((element) => element.scrollHeight - element.clientHeight)
    ).toBeGreaterThan(0);
    await expect(scroller(page)).toHaveJSProperty("scrollTop", 0);
  });
});

test.describe("the sidebar", () => {
  test("only its tree scrolls: the logo and the search stay at the top", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 200 });
    await page.goto(story("overview"));
    const tree = page.locator(".forgebook-tree");
    const searchTop = await page
      .locator(".forgebook-search")
      .evaluate((element) => element.getBoundingClientRect().top);
    await tree.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect.poll(() => tree.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(
      await page.locator(".forgebook-search").evaluate((element) => element.getBoundingClientRect().top)
    ).toBe(searchTop);
    await expect(page.locator(".forgebook-sidebar")).toHaveJSProperty("scrollTop", 0);
  });

  test("the search field keeps its height whether the tree is long or a search leaves it short", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1200, height: 140 });
    await page.goto(story("overview"));
    const field = page.locator(".forgebook-search");
    const fullHeight = await field.evaluate((element) => element.getBoundingClientRect().height);
    await page.getByRole("searchbox").fill("no such component");
    await expect
      .poll(() => field.evaluate((element) => element.getBoundingClientRect().height))
      .toBe(fullHeight);
    expect(fullHeight).toBeGreaterThanOrEqual(28);
  });

  test("a family once open stays open when a component elsewhere opens", async ({ page }) => {
    await page.goto(story("overview"));
    await expect(page.getByRole("button", { name: /^Inputs/ })).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: /^Foundations/ }).click();
    await sidebarLinks(page).getByRole("link", { name: /^Page/ }).click();
    await expect(page).toHaveURL(/component=kit%3Afoundations-page/);
    await expect(page.getByRole("button", { name: /^Inputs/ })).toHaveAttribute("aria-expanded", "true");
  });

  test("a named group starts shut unless it holds the shown component, folds animated, and a search opens it", async ({
    page
  }) => {
    await page.goto(story("overview"));
    const tree = sidebarLinks(page);
    // the shown component's group is open
    await expect(tree.getByRole("button", { name: /^Selection/ })).toHaveAttribute("aria-expanded", "true");
    await tree.getByRole("button", { name: /^Forms/ }).click();
    const fields = tree.getByRole("button", { name: /^Fields/ });
    await expect(fields).toHaveAttribute("aria-expanded", "false");
    await expect(tree.getByRole("link", { name: "Select in Inputs" })).toHaveCount(0);
    // it grows open: drawn at once, its height moving to its content's, frame by frame
    const heights = await fields.evaluate(
      (button) =>
        new Promise<number[]>((resolve) => {
          const fold = button.closest(".forgebook-tree__group")?.querySelector(".forgebook-tree__fold");
          const seen: number[] = [];
          const tick = (): void => {
            seen.push(Math.round(fold?.getBoundingClientRect().height ?? -1));
            if (seen.length < 30) requestAnimationFrame(tick);
            else resolve(seen);
          };
          requestAnimationFrame(tick);
          (button as HTMLButtonElement).click();
        })
    );
    const full = heights.at(-1) ?? 0;
    expect(full).toBeGreaterThan(0);
    expect(heights.some((height) => height > 0 && height < full)).toBe(true);
    await expect(tree.getByRole("link", { name: "Select in Inputs" })).toBeVisible();
    // shut again, its entries leave once the fold has played
    await fields.click();
    await expect(tree.getByRole("link", { name: "Select in Inputs" })).toHaveCount(0);
    // a search opens every group it finds something in
    await page.getByRole("searchbox").fill("select");
    await expect(fields).toHaveAttribute("aria-expanded", "true");
  });
});

test.describe("aliases and related pages", () => {
  test("an alias entry in another place opens the same page, which says where the component lives", async ({
    page
  }) => {
    await page.goto("/?component=kit:foundations-page");
    const tree = page.getByRole("navigation", { name: "Components" });
    await tree.getByRole("button", { name: /^Forms/ }).click();
    // a named group starts shut: its button opens it
    const fields = tree.getByRole("button", { name: /^Fields/ });
    await expect(fields).toHaveAttribute("aria-expanded", "false");
    await fields.click();
    const alias = tree.getByRole("link", { name: "Select in Inputs" });
    await expect(alias.locator("xpath=..")).toHaveAttribute("title", /Lives in Inputs › Selection › Select/);
    // the alias is not counted as one of the family's components
    await expect(tree.getByRole("button", { name: /^Forms/ })).toHaveText("Forms0");
    await alias.click();
    await expect(page).toHaveURL(/component=kit%3Ainputs-selection-select/);
    await expect(page.locator(".forgebook-header__path")).toHaveText(
      "Fixture kit · Inputs · Selection · also listed in Forms › Fields"
    );
    // the sidebar marks the entry where it lives, in its own family, not the alias
    await expect(tree.locator('[aria-current="page"]')).toHaveText(/^Select\d+$/);
    await expect(alias).not.toHaveAttribute("aria-current");
  });

  test("a related component is linked at the top of both pages", async ({ page }) => {
    await page.goto("/?component=kit:inputs-selection-select");
    const related = page.getByRole("navigation", { name: "Related" });
    await expect(related.getByRole("link")).toHaveText(["Page"]);
    await related.getByRole("link", { name: "Page" }).click();
    await expect(page).toHaveURL(/component=kit%3Afoundations-page/);
    await expect(page.getByRole("navigation", { name: "Related" }).getByRole("link")).toHaveText(["Select"]);
    // a story's page has the same header
    await page.goto(story("small"));
    await expect(page.getByRole("navigation", { name: "Related" }).getByRole("link")).toHaveText(["Page"]);
  });
});

test.describe("a story's declared height", () => {
  test("the frame has the declared height from the start, before the story reports its own", async ({
    page
  }) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/Select\.stories\.tsx$/, async (route) => {
      await held;
      await route.continue();
    });
    await page.goto(story("overlay-in-room"));
    const frame = page.locator("iframe.forgebook-frame-view");
    await expect(frame).toHaveCSS("height", "280px");
    release();
    await frameStatus(page);
    await expect.poll(() => frame.evaluate((element) => element.getBoundingClientRect().height)).toBe(280);
  });

  test("the story checks flag an overlay past the frame, not one in the declared room or pinned to the window", async ({
    page
  }) => {
    for (const [name, sceneHeight, expected] of [
      ["overlay-past", 0, ["ul#0"]],
      ["overlay-in-room", 280, []]
    ] as const) {
      await page.goto(`/frame.html?story=kit:inputs-selection-select--${name}`);
      await expect(page.locator("html")).toHaveAttribute("data-forgebook-status", "ready");
      const overlays = await findOverlaysPastFrame(page, sceneHeight);
      expect(overlays.map((overlay) => overlay.element)).toEqual(expected);
    }
  });
});

test.describe("the sidebar's layout", () => {
  test("hides and shows again, keeping its width; the browser remembers both", async ({ page }) => {
    await page.goto(story("overview"));
    await page.getByRole("separator", { name: "Sidebar width" }).focus();
    await page.keyboard.press("ArrowRight");
    const width = await page
      .locator(".forgebook-sidebar")
      .evaluate((element) => element.getBoundingClientRect().width);
    const sidebar = page.locator(".forgebook-sidebar");
    await page.getByRole("button", { name: "Hide the sidebar" }).click();
    await page.reload();
    // hidden, it stays mounted, slid out and out of Tab's and screen readers' reach
    await expect(sidebar).toHaveAttribute("inert");
    await expect(sidebar).not.toBeInViewport();
    await page.getByRole("button", { name: "Show the sidebar" }).click();
    await expect(sidebar).toBeInViewport();
    await expect(sidebar).toHaveJSProperty("offsetWidth", width);
  });

  test("hidden and shown again, it keeps its search", async ({ page }) => {
    await page.goto(story("overview"));
    await page.getByRole("searchbox").fill("select");
    await page.getByRole("button", { name: "Hide the sidebar" }).click();
    await page.getByRole("button", { name: "Show the sidebar" }).click();
    await expect(page.getByRole("searchbox")).toHaveValue("select");
  });
});

test.describe("the stage", () => {
  test("the outlines reach what a story mounts beside its root, as a popover's portal", async ({ page }) => {
    await page.goto(story("with-popup", "tools=outline"));
    await frameStatus(page);
    await expect(frameOf(page).getByTestId("popup")).toHaveCSS("outline-style", "solid");
    await expect(frameOf(page).locator("#root")).toHaveCSS("outline-style", "none");
  });

  test("a typed width reaches the address, and a double click on a handle gives back the whole stage", async ({
    page
  }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    await page.getByLabel("Width in px").fill("420");
    await page.getByLabel("Width in px").press("Enter");
    await expect(page).toHaveURL(/width=420/);
    await expect(page.locator(".forgebook-viewport__room")).toHaveJSProperty("offsetWidth", 420);
    await page.locator('.forgebook-viewport__handle[data-side="end"]').dblclick();
    await expect(page).not.toHaveURL(/width=/);
  });

  test("the handle at the story's foot sets its height from the declared one, and a double click gives it back", async ({
    page
  }) => {
    await page.goto(story("overlay-in-room"));
    await frameStatus(page);
    const frame = page.locator("iframe.forgebook-frame-view");
    const foot = page.getByRole("separator", { name: "Story height" });
    // the keys start from the height the story has: the 280 px it declares
    await foot.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/height=290/);
    await expect(frame).toHaveCSS("height", "290px");
    // a drag follows the pointer one for one, and the frame's window is that height
    const box = await foot.boundingBox();
    if (box === null) throw new Error("The foot handle has no box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 150, { steps: 5 });
    await page.mouse.up();
    await expect(page).toHaveURL(/height=140/);
    await expect(frame).toHaveCSS("height", "140px");
    await expect
      .poll(() =>
        frameOf(page)
          .locator("html")
          .evaluate(() => window.innerHeight)
      )
      .toBe(140);
    await expect(foot).toHaveText("140 px");
    // another story opens at its own height
    await page.getByLabel("Stories", { exact: true }).selectOption({ label: "Small" });
    await expect(page).toHaveURL(/select--small/);
    await expect(page).not.toHaveURL(/height=/);
    await page.goBack();
    await expect(page).toHaveURL(/height=140/);
    await frameStatus(page);
    await page.getByRole("separator", { name: "Story height" }).dblclick();
    await expect(page).not.toHaveURL(/height=/);
    await expect(frame).toHaveCSS("height", "280px");
  });

  test("the toolbar's field shows the width the story fills, and the floating tools zoom a step at a time", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto(story("overview"));
    await frameStatus(page);
    const roomWidth = await page
      .locator(".forgebook-viewport__room")
      .evaluate((room) => (room as HTMLElement).offsetWidth);
    await expect(page.getByLabel("Width in px")).toHaveValue(String(roomWidth));
    const tools = page.getByRole("toolbar", { name: "Zoom and measuring tools" });
    await tools.getByRole("button", { name: "Zoom in" }).click();
    await expect(page).toHaveURL(/zoom=125/);
    await tools.getByRole("button", { name: /Back to 100%/ }).click();
    await expect(page).not.toHaveURL(/zoom=/);
    await tools.getByRole("button", { name: "8 px grid" }).click();
    await expect(tools.getByRole("button", { name: "8 px grid" })).toHaveAttribute("aria-pressed", "true");
  });

  test("the story's id is a button in its bar, not a line under the stage", async ({ page }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    await expect(page.getByRole("button", { name: "Copy the story's id" })).toHaveAttribute(
      "title",
      /kit:inputs-selection-select--overview/
    );
  });

  test("a story zoomed wider than the stage scrolls to its start, not cut on the left", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto(story("overview", "width=1024&zoom=150"));
    await frameStatus(page);
    const canvas = page.locator(".forgebook-viewport__canvas");
    const start = await canvas.evaluate((element) => {
      element.scrollLeft = 0;
      const zoomed = element.querySelector(".forgebook-viewport__zoom");
      return (zoomed?.getBoundingClientRect().left ?? 0) - element.getBoundingClientRect().left;
    });
    expect(start).toBeGreaterThanOrEqual(0);
  });

  test("a story's box waits at its measured height while it loads, then takes its own", async ({ page }) => {
    // the story's module is held back: its frame is there and reports the empty document's height, which must not
    // fold the box
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/Select\.stories\.tsx$/, async (route) => {
      await held;
      await route.continue();
    });
    await page.goto(story("small"));
    const frame = page.locator("iframe.forgebook-frame-view");
    await expect(frame).toHaveCSS("height", "777px");
    await expect(page.locator(".forgebook-frame-loading")).toBeVisible();
    // the frame's document is up and has told its height by now; the box keeps waiting at the measured one
    await expect(frameOf(page).locator("body")).toBeAttached();
    await page.waitForTimeout(300);
    await expect(frame).toHaveCSS("height", "777px");
    release();
    await frameStatus(page);
    await expect
      .poll(() => frame.evaluate((element) => element.getBoundingClientRect().height))
      .not.toBe(777);
  });

  test("a story's box waits on its source's page colour for the theme, not on white", async ({ page }) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/Select\.stories\.tsx$/, async (route) => {
      await held;
      await route.continue();
    });
    await page.goto(story("small", "theme=dark"));
    await expect(page.locator(".forgebook-frame-loading")).toBeVisible();
    await expect(page.locator(".forgebook-viewport__room")).toHaveCSS("background-color", "rgb(17, 17, 17)");
    release();
    await frameStatus(page);
    await page.getByRole("radio", { name: "Light" }).check({ force: true });
    await expect(page.locator(".forgebook-viewport__room")).toHaveCSS(
      "background-color",
      "rgb(250, 250, 250)"
    );
  });

  test("the theme reaches the frame live: same document, new attribute", async ({ page }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    await frameOf(page)
      .locator("html")
      .evaluate((root) => root.setAttribute("data-test-mark", "kept"));
    await page.getByRole("radio", { name: "Dark" }).check({ force: true });
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-test-mark", "kept");
  });

  test("a switch the catalogue declares sits in the View menu and reaches the frame live", async ({
    page
  }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    await frameOf(page)
      .locator("html")
      .evaluate((root) => root.setAttribute("data-test-mark", "kept"));
    await clickView(page);
    await popoversSettled(page);
    const motion = page.getByRole("group", { name: "Motion" });
    await expect(motion.getByRole("radio")).toHaveCount(6);
    await motion.getByRole("radio", { name: "Reduced" }).check({ force: true });
    await expect(page).toHaveURL(/motion=reduced/);
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-motion-amount", "reduced");
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-test-mark", "kept");
    // its unset value, the system's, writes nothing on the root
    await motion.getByRole("radio", { name: "System" }).check({ force: true });
    await expect(frameOf(page).locator("html")).not.toHaveAttribute("data-motion-amount");
  });

  test("the catalogue's own width, background and grid step reach the toolbar and the frame", async ({
    page
  }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    await page.getByRole("radio", { name: "Phone L" }).check({ force: true });
    await expect(page).toHaveURL(/width=412/);
    await clickView(page);
    await page.getByLabel("Background", { exact: true }).selectOption("paper");
    await expect(page).toHaveURL(/backdrop=paper/);
    // a style element's text is not shown text: its content is read as is
    await expect
      .poll(async () =>
        frameOf(page)
          .locator("#forgebook-backdrop-style")
          .evaluate((style) => style.textContent)
      )
      .toContain("#f5efe0");
    await page.goto(story("overview", "tools=grid"));
    await frameStatus(page);
    await expect(frameOf(page).locator("#root")).toHaveCSS("background-size", "4px 4px, 4px 4px");
  });

  test("the catalogue renames a text of the shell, and keeps what the browser stores under its own id", async ({
    page
  }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    await expect(page.getByRole("tab", { name: /Parts and hooks/ })).toBeVisible();
    await page.getByRole("separator", { name: "Sidebar width" }).focus();
    await page.keyboard.press("ArrowRight");
    const keys = await page.evaluate(() => Object.keys(window.localStorage));
    expect(keys).toContain("fixture:sidebar-width");
    expect(keys.filter((key) => key.startsWith("forgebook:"))).toEqual([]);
  });

  test("the frame says it loads until its story is ready", async ({ page }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    await expect(page.getByRole("status").filter({ hasText: "Loading the story" })).toHaveCount(0);
  });

  test("the sidebar never lists stories: they are picked in the header", async ({ page }) => {
    await page.goto(story("overview"));
    // Inputs is open (the shown component's family), Foundations closed: one link, the component's, none for a story
    // the section after the Docs one: the library's families
    const families = page.getByRole("navigation", { name: "Components" }).locator("section").nth(1);
    await expect(families.getByRole("link")).toHaveText([/^Select\d+$/]);
  });

  test("a story that throws shows its error in the frame", async ({ page }) => {
    await page.goto(story("throws"));
    expect(await frameStatus(page)).toBe("error");
    await expect(frameOf(page).getByRole("alert")).toContainText("The fixture story threw");
  });

  test("the compare view draws the story once per theme and contrast", async ({ page }) => {
    await page.goto(story("overview", "compare=theme"));
    await expect(page.locator(".forgebook-compare iframe")).toHaveCount(4);
    await expect(page.locator(".forgebook-compare__label")).toHaveText([
      "Light",
      "Dark",
      "Light · More contrast",
      "Dark · More contrast"
    ]);
  });
});

test.describe("the component's page", () => {
  test("shows the lead, the demo with its code, the documentation file, the API reference, then the examples", async ({
    page
  }) => {
    await page.goto("/?component=kit:inputs-selection-select");
    await expect(page.locator(".forgebook-doc__lead")).toHaveText(
      "A select for the catalogue's tests: one value picked from a list, in three sizes."
    );
    const demo = page.locator(".forgebook-example[data-demo]");
    await expect(demo.locator("iframe")).toHaveAttribute(
      "src",
      /story=kit%3Ainputs-selection-select--in-row/
    );
    const code = demo.locator(".forgebook-example__code");
    await expect(code).toHaveAttribute("inert");
    await demo.getByRole("button", { name: "Show code" }).click();
    await expect(code).not.toHaveAttribute("inert");
    await expect(code.locator(".forgebook-hl-name").first()).toHaveText("div");
    await expect(code).toContainText('<Select options={["weekly", "monthly"]}');
    const prose = page.locator(".forgebook-prose");
    await expect(prose).toContainText("the fixture's documentation, shown on its component page");
    await expect(prose.locator("h2")).toHaveText(["Accessibility"]);
    await expect(prose).not.toContainText("written by hand");
    await expect(prose.locator("pre .forgebook-hl-keyword").first()).toHaveText("import");
    await expect(page.locator(".forgebook-api__table").first().locator("tbody th")).toContainText([
      "options"
    ]);
    // a part with no story file of its own, named in the meta's subcomponents, has its props under the component's
    const group = page.getByRole("region", { name: "SelectGroup" });
    await expect(group.getByRole("heading", { level: 3 })).toHaveText("SelectGroup");
    await expect(group).toContainText("Groups a select's options under a label.");
    await expect(group.locator(".forgebook-api__table").first().locator("tbody th")).toContainText([
      "label",
      "isFolded",
      "children"
    ]);
    await expect(group.getByRole("heading", { level: 4 })).toHaveText("Events");
    const examples = page.locator(".forgebook-example:not([data-demo])");
    await expect(examples.first()).toHaveAccessibleName("Overview");
    await expect(page.getByRole("article", { name: "In row", exact: true })).toHaveCount(0);
  });

  test("an example's box fills the page and goes back to its place, its story never loaded again", async ({
    page
  }) => {
    await page.goto("/?component=kit:inputs-selection-select");
    const overview = page.getByRole("article", { name: "Overview", exact: true });
    const frame = overview.locator("iframe");
    const root = overview.frameLocator("iframe").locator("html");
    // a frame loads only near the visible part: the API table may push the example past it, so it is brought in view
    await overview.scrollIntoViewIfNeeded();
    // a frame further down the page may load slowly while the other tests run: its readiness gets more time
    await expect(root).toHaveAttribute("data-forgebook-status", /.+/, { timeout: 15_000 });
    await root.evaluate((element) => element.setAttribute("data-test-mark", "kept"));
    const place = await overview.locator(".forgebook-example__box").boundingBox();
    const address = page.url();
    await overview.getByRole("button", { name: "Fill the page with Overview" }).click();
    const box = page.getByRole("dialog", { name: "Overview" });
    // over the page, the page's own size less its margin, and the story fills the room it has
    await expect.poll(async () => (await box.boundingBox())?.width).toBe(1280 - 48);
    await expect.poll(async () => (await frame.boundingBox())?.height ?? 0).toBeGreaterThan(600);
    // the list keeps the box's place: nothing under it moves
    await expect(overview.locator(".forgebook-example__slot")).toHaveCSS("height", `${place?.height}px`);
    await expect(root).toHaveAttribute("data-test-mark", "kept");
    // a moment's look, not a page: the address stays as it was
    expect(page.url()).toBe(address);
    await page.keyboard.press("Escape");
    await expect(box).toHaveCount(0);
    await expect(overview.locator(".forgebook-example__box[data-full]")).toHaveCount(0);
    // opened by the pointer, Escape leaves no focus ring on its button
    await expect(overview.getByRole("button", { name: "Fill the page with Overview" })).not.toHaveCSS(
      "outline-style",
      "solid"
    );
    await expect(root).toHaveAttribute("data-test-mark", "kept");
    // a press on the shade brings it back too
    await overview.getByRole("button", { name: "Fill the page with Overview" }).click();
    await page.locator(".forgebook-full-shade").click({ position: { x: 5, y: 5 } });
    await expect(overview.locator(".forgebook-example__box[data-full]")).toHaveCount(0);
  });

  test("over the page, an example's story takes a width of its own, which the page and the address never see", async ({
    page
  }) => {
    await page.goto("/?component=kit:inputs-selection-select");
    const overview = page.getByRole("article", { name: "Overview", exact: true });
    const frame = overview.locator("iframe");
    // a frame loads only near the visible part: the API table may push the example past it, so it is brought in view
    await overview.scrollIntoViewIfNeeded();
    const pageWidth = (await frame.boundingBox())?.width;
    const address = page.url();
    // in the list the stage has no handles: the width is the page's
    await expect(overview.locator(".forgebook-viewport__handle")).toHaveCount(0);
    await overview.getByRole("button", { name: "Fill the page with Overview" }).click();
    const box = page.getByRole("dialog", { name: "Overview" });
    await settled(box);
    await box.getByRole("radio", { name: "560" }).check({ force: true });
    await expect.poll(async () => (await frame.boundingBox())?.width).toBe(560);
    await expect(box.locator(".forgebook-viewport__handle")).toHaveCount(2);
    expect(page.url()).toBe(address);
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await frame.boundingBox())?.width).toBe(pageWidth);
    // opened again, it starts at the page's width
    await overview.getByRole("button", { name: "Fill the page with Overview" }).click();
    await expect(box.getByRole("radio", { name: "Fill" })).toBeChecked();
  });

  test("Used in lists the components whose stories use it, opens them, and folds away for the next visit", async ({
    page
  }) => {
    await page.goto("/?component=kit:inputs-selection-select");
    const usedIn = page.getByRole("region", { name: "Used in" });
    // the kit's Form renders a Select; Page is in Select's related, so it is left out
    const form = usedIn.getByRole("link", { name: "Form", exact: true });
    await expect(form).toBeVisible();
    await expect(usedIn).toContainText("1 story");
    await expect(usedIn.getByRole("link", { name: "Page", exact: true })).toHaveCount(0);
    await usedIn.getByRole("link", { name: "Signup" }).click();
    await expect(page).toHaveURL(/story=kit%3Alayouts-form--signup/);
    await page.goBack();
    // folded, its usage is no longer drawn, and the browser keeps it folded
    const toggle = page.getByRole("button", { name: "Used in" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(usedIn.getByRole("link", { name: "Form", exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Used in" })).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Used in" }).click();
    await expect(
      page.getByRole("region", { name: "Used in" }).getByRole("link", { name: "Form", exact: true })
    ).toBeVisible();
    // a component no other component's stories use gets no block: there is nothing to say
    await page.goto("/?component=kit:interaction-touch-pad");
    await expect(page.getByRole("heading", { name: "API reference" })).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByRole("region", { name: "Used in" })).toHaveCount(0);
  });

  test("every example opens its story from its bar, not only the demo", async ({ page }) => {
    await page.goto("/?component=kit:inputs-selection-select");
    const overview = page.getByRole("article", { name: "Overview", exact: true });
    await overview.getByRole("link", { name: "Open the story Overview" }).click();
    await expect(page).toHaveURL(/story=kit%3Ainputs-selection-select--overview/);
  });
});

test.describe("the toolbar each person arranges", () => {
  // wide enough for the default bar and two more controls
  test.use({ viewport: { width: 1600, height: 900 } });

  /** The controls on the bar, by id, in their order. */
  const barControls = (page: Page): Promise<string[]> =>
    page
      .locator(".forgebook-toolbar__pinned")
      .evaluateAll((pinned) => pinned.map((each) => (each as HTMLElement).dataset["control"] ?? ""));

  /** The View menu's rows, by id, in their order. */
  const menuRows = (page: Page): Promise<string[]> =>
    page
      .locator(".forgebook-arrange")
      .evaluateAll((rows) => rows.map((each) => (each as HTMLElement).dataset["control"] ?? ""));

  // the button's name takes its dot's when a value it holds is changed
  const openView = async (page: Page): Promise<void> => {
    await clickView(page);
    await popoversSettled(page);
  };

  test("starts with View first, then the colour scheme, the contrast and the width, the panel and Compare last", async ({
    page
  }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    const toolbar = page.locator(".forgebook-toolbar");
    await expect(toolbar.locator("> *").first()).toHaveClass(/forgebook-view-menu/);
    expect(await barControls(page)).toEqual(["theme", "contrast", "width"]);
    await expect(toolbar.locator("> *").last()).toHaveClass(/forgebook-view-menu/);
    await expect(toolbar.locator("> *").last().getByRole("button")).toHaveAccessibleName("Compare");
    await openView(page);
    expect(await menuRows(page)).toEqual([
      "theme",
      "contrast",
      "width",
      "motion",
      "speed",
      "press",
      "probe",
      "lang",
      "dir",
      "touch",
      "backdrop",
      "sheets",
      "text",
      "audience"
    ]);
    await expect(page.getByRole("button", { name: "Reset toolbar" })).toBeDisabled();
  });

  test("a control pinned from View works on the bar, stays after a reload, and Reset toolbar takes it back", async ({
    page
  }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    await openView(page);
    await page.getByRole("button", { name: "Pin Speed to the toolbar" }).click();
    await expect(page.getByRole("button", { name: "Pin Speed to the toolbar" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await page.keyboard.press("Escape");
    expect(await barControls(page)).toEqual(["theme", "contrast", "width", "speed"]);
    const onBar = page.locator('.forgebook-toolbar__pinned[data-control="speed"]');
    await onBar.getByRole("radio", { name: "Fast" }).check({ force: true });
    await expect(page).toHaveURL(/speed=fast/);
    // a value on the bar is not the View menu's: its dot stays off
    await expect(page.getByRole("img", { name: "A view setting is changed" })).toHaveCount(0);
    await page.reload();
    await frameStatus(page);
    expect(await barControls(page)).toEqual(["theme", "contrast", "width", "speed"]);
    await openView(page);
    await page.getByRole("button", { name: "Reset toolbar" }).click();
    expect(await barControls(page)).toEqual(["theme", "contrast", "width"]);
  });

  test("a hidden control leaves View and the bar, still applies, and comes back where it was", async ({
    page
  }) => {
    await page.goto(story("overview", "press=shrink"));
    await frameStatus(page);
    await openView(page);
    await page.getByRole("button", { name: "Hide Press in View" }).click();
    expect(await menuRows(page)).not.toContain("press");
    // hidden, its value still applies, and the View menu's dot says something it holds is changed
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-press", "shrink");
    await expect(page.getByRole("img", { name: "A view setting is changed" })).toBeVisible();
    // opened, the hidden controls are rows like the others, still usable
    await page.getByRole("button", { name: "1 hidden" }).click();
    const hiddenRow = page.locator('.forgebook-arrange[data-hidden][data-control="press"]');
    await hiddenRow.getByRole("radio", { name: "Darken", exact: true }).check({ force: true });
    await expect(page).toHaveURL(/press=darken/);
    await page.getByRole("button", { name: "Show Press" }).click();
    expect((await menuRows(page)).slice(4, 7)).toEqual(["speed", "press", "probe"]);
  });

  test("the rows move by keyboard and by pointer, and the bar follows their order", async ({ page }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    await openView(page);
    await page.getByRole("button", { name: "Pin Motion to the toolbar" }).click();
    // by keyboard: Motion above the width, announced
    const handle = page.getByRole("button", { name: "Move Motion" });
    await handle.focus();
    await page.keyboard.press("ArrowUp");
    await expect(handle).toBeFocused();
    expect((await menuRows(page)).slice(0, 4)).toEqual(["theme", "contrast", "motion", "width"]);
    await expect(page.locator("[aria-live]")).toHaveText("Motion, 3 of 14");
    expect(await barControls(page)).toEqual(["theme", "contrast", "motion", "width"]);
    // by pointer: the theme dragged below the contrast
    const grip = page.getByRole("button", { name: "Move Theme" });
    const from = await grip.boundingBox();
    const to = await page.getByRole("button", { name: "Move More contrast" }).boundingBox();
    if (from === null || to === null) throw new Error("the handles are not drawn");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, to.y + to.height, { steps: 8 });
    await page.mouse.up();
    expect((await menuRows(page)).slice(0, 2)).toEqual(["contrast", "theme"]);
    expect(await barControls(page)).toEqual(["contrast", "theme", "motion", "width"]);
    // drags one after another leave every row in its place: none still shifted, none on another
    for (const [name, rows] of [
      ["Text", -6],
      ["Speed", 3],
      ["Styles", -5]
    ] as const) {
      const box = await page.getByRole("button", { name: `Move ${name}` }).boundingBox();
      if (box === null) throw new Error(`the handle of ${name} is not drawn`);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + rows * box.height, { steps: 20 });
      await page.mouse.up();
    }
    const rowsDrawn = page.locator(".forgebook-arrange");
    await expect
      .poll(() =>
        rowsDrawn.evaluateAll((rows) => {
          // the room between one row and the next, the same everywhere: a row with a note under it is taller
          const boxes = rows.map((row) => row.getBoundingClientRect());
          const steps = new Set(
            boxes.slice(1).map((box, index) => Math.round(box.top - (boxes[index]?.bottom ?? 0)))
          );
          const shifted = rows.filter((row) => (row as HTMLElement).style.transform !== "").length;
          return { steps: steps.size, shifted };
        })
      )
      .toEqual({ steps: 1, shifted: 0 });
  });

  test("a right-click on a control of the bar takes it off, or hides it in View while it stays on the bar", async ({
    page
  }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    await page.locator('.forgebook-toolbar__pinned[data-control="contrast"]').click({ button: "right" });
    const menu = page.getByRole("menu", { name: "More contrast on the toolbar" });
    await expect(menu.getByRole("menuitem").first()).toBeFocused();
    await menu.getByRole("menuitem", { name: "Remove from the toolbar" }).click();
    expect(await barControls(page)).toEqual(["theme", "width"]);
    // hidden in View, the theme stays on the bar and takes no row in the menu
    await page.locator('.forgebook-toolbar__pinned[data-control="theme"]').click({ button: "right" });
    await page.getByRole("menuitem", { name: "Hide in View" }).click();
    expect(await barControls(page)).toEqual(["theme", "width"]);
    await openView(page);
    expect(await menuRows(page)).not.toContain("theme");
    // the count says how many of the hidden still sit on the bar
    await page.getByRole("button", { name: "1 hidden · 1 on the toolbar" }).click();
    await expect(page.getByRole("button", { name: "Pin Theme to the toolbar" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("a narrow window keeps in View the pinned controls the bar has no room for, and gives them back", async ({
    page
  }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    await openView(page);
    await page.getByRole("button", { name: "Pin Motion to the toolbar" }).click();
    await page.keyboard.press("Escape");
    expect(await barControls(page)).toContain("motion");
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect.poll(() => barControls(page)).not.toContain("motion");
    // the bar stays one line: no control squeezed or wrapped
    await expect(page.locator(".forgebook-toolbar")).toHaveCSS("height", "44px");
    await openView(page);
    await expect(page.locator('.forgebook-arrange[data-control="motion"]')).toHaveAttribute("data-moved", "");
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1600, height: 900 });
    await expect.poll(() => barControls(page)).toContain("motion");
  });

  test("the View menu grows in and out, and a press on its button while it closes opens it again", async ({
    page
  }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    const button = page.getByRole("button", { name: /^View/ });
    await openView(page);
    await page.keyboard.press("Escape");
    // still drawn while it closes, but closed for its button and a press on it
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await popoversSettled(page);
    await expect(page.locator(".forgebook-popover--arrange")).toHaveCSS("opacity", "1");
    await page.keyboard.press("Escape");
    await expect(page.locator(".forgebook-popover--arrange")).toHaveCount(0);
  });

  test("a bar the person lets wrap keeps every pinned control, on more lines", async ({ page }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    await openView(page);
    await page.getByRole("button", { name: "Pin Motion to the toolbar" }).click();
    await page.getByRole("switch", { name: "Wrap the toolbar onto more lines when it is full" }).check();
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect.poll(() => barControls(page)).toEqual(["theme", "contrast", "width", "motion"]);
    const height = await page
      .locator(".forgebook-toolbar")
      .evaluate((bar) => bar.getBoundingClientRect().height);
    expect(height).toBeGreaterThan(44);
    // kept for the next visit
    await page.reload();
    await frameStatus(page);
    expect(await barControls(page)).toEqual(["theme", "contrast", "width", "motion"]);
  });
});

test.describe("the stories' texts", () => {
  test("are drawn in the chosen language, English where it lacks a key, and pseudo-translated", async ({
    page
  }) => {
    await page.goto(story("in-row"));
    await frameStatus(page);
    await expect(frameOf(page).locator("span").first()).toHaveText("Billing period");
    await page.goto(story("in-row", "lang=it"));
    await frameStatus(page);
    await expect(frameOf(page).locator("span").first()).toHaveText("Periodo di fatturazione");
    await expect(frameOf(page).locator("span").last()).toHaveText("2 plans");
    await page.goto(story("in-row", "lang=pseudo"));
    await frameStatus(page);
    await expect(frameOf(page).locator("span").first()).toHaveText(/^\[Bîllîñg pérîöd·+\]$/);
  });

  test("right to left: the direction switch and a language read so set dir on the story's root, live", async ({
    page
  }) => {
    await page.goto(story("in-row", "dir=rtl"));
    await frameStatus(page);
    const root = frameOf(page).locator("html");
    await expect(root).toHaveAttribute("dir", "rtl");
    await root.evaluate((element) => element.setAttribute("data-test-mark", "kept"));
    await clickView(page);
    await popoversSettled(page);
    await page.getByRole("group", { name: "Direction" }).getByRole("radio", { name: "Left to right" }).check({
      force: true
    });
    // left to right is the root's own: no attribute, and the frame kept its story
    await expect(root).not.toHaveAttribute("dir");
    await expect(root).toHaveAttribute("data-test-mark", "kept");
    await page.goto(story("in-row", "lang=ar"));
    await frameStatus(page);
    await expect(frameOf(page).locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("another language draws the story without loading its frame again", async ({ page }) => {
    await page.goto(story("in-row"));
    await frameStatus(page);
    await frameOf(page)
      .locator("html")
      .evaluate((root) => root.setAttribute("data-test-mark", "kept"));
    await clickView(page);
    await page.getByLabel("Language", { exact: true }).selectOption("it");
    await expect(page).toHaveURL(/lang=it/);
    await expect(frameOf(page).locator("span").first()).toHaveText("Periodo di fatturazione");
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-test-mark", "kept");
  });

  test("an arg named by its key reaches the story in the chosen language, and the panel shows it with its key", async ({
    page
  }) => {
    await page.goto(story("hinted", "lang=it"));
    await frameStatus(page);
    await expect(frameOf(page).locator("small")).toHaveText("Addebitato all'inizio di ogni periodo");
    const field = page.getByRole("textbox", { name: "hint", exact: true });
    await expect(field).toHaveValue("Addebitato all'inizio di ogni periodo");
    const note = page.locator(".forgebook-prop__text-arg");
    await expect(note).toContainText("select.hint");
    await field.fill("Una nota mia");
    await expect(frameOf(page).locator("small")).toHaveText("Una nota mia");
    await note.getByRole("button", { name: "Back to the text" }).click();
    await expect(frameOf(page).locator("small")).toHaveText("Addebitato all'inizio di ogni periodo");
    await expect(note.getByRole("button")).toHaveCount(0);
  });
});

test.describe("touch", () => {
  /** The touch pad's story, in touch or with the mouse. */
  const touchPad = (query = "touch=touch"): string => `/?story=kit:interaction-touch-pad--overview&${query}`;

  /** The pad's event log, one entry a line. */
  const eventLog = (page: Page): Promise<string[]> =>
    frameOf(page).getByRole("list", { name: "Events" }).getByRole("listitem").allTextContents();

  /** The centre of a part of the story, in the page. */
  const centreOf = async (part: Locator): Promise<{ x: number; y: number }> => {
    const box = await part.boundingBox();
    if (box === null) throw new Error("the part is not drawn");
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  test("a tap sends a finger's events and a touch click, a long press the menu, and the CSS answers as a phone's", async ({
    page
  }) => {
    await page.goto(touchPad());
    await frameStatus(page);
    const button = await centreOf(frameOf(page).getByRole("button", { name: "Press me" }));
    await page.mouse.move(button.x, button.y);
    await page.mouse.down();
    await page.mouse.up();
    await expect
      .poll(() => eventLog(page))
      .toEqual(["pointerdown touch", "touchstart 1", "pointerup touch", "touchend 0", "click touch"]);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    await expect.poll(async () => (await eventLog(page)).includes("contextmenu")).toBe(true);
    await expect(frameOf(page).getByText("A phone's media")).toBeVisible();
    const hover = frameOf(page).getByText("Hover me");
    const point = await centreOf(hover);
    await page.mouse.move(point.x, point.y);
    await expect(hover).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(frameOf(page).locator(".forgebook-touch-dot:not([hidden])")).toHaveCount(1);
  });

  test("the keyboard still clicks, a captured pointer is released on the lift, and turning touch off ends a press", async ({
    page
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(touchPad());
    await frameStatus(page);
    // a finger changes nothing of the keyboard: Enter on a button still clicks it
    await frameOf(page).getByRole("button", { name: "Press me" }).focus();
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (await eventLog(page)).some((entry) => entry.startsWith("click")))
      .toBe(true);
    // the drawing area captures its pointer on the press and releases it on the lift
    const drawing = await centreOf(frameOf(page).getByRole("img", { name: "Drawing area" }));
    await page.mouse.move(drawing.x, drawing.y);
    await page.mouse.down();
    await page.mouse.move(drawing.x + 30, drawing.y);
    await page.mouse.up();
    // a press under way when touch goes off is cancelled: its long press never opens the menu
    const button = await centreOf(frameOf(page).getByRole("button", { name: "Press me" }));
    await page.mouse.move(button.x, button.y);
    await page.mouse.down();
    await frameOf(page)
      .locator("html")
      .evaluate((root) => root.removeAttribute("data-forgebook-touch"));
    await page.waitForTimeout(700);
    await page.mouse.up();
    expect(await eventLog(page)).not.toContain("contextmenu");
    expect(errors).toEqual([]);
  });

  test("a drag scrolls a list, not a part that keeps its moves, and Shift puts two fingers down", async ({
    page
  }) => {
    await page.goto(touchPad());
    await frameStatus(page);
    const list = frameOf(page).getByRole("list", { name: "Scrolling list" });
    const start = await centreOf(list);
    await page.mouse.move(start.x, start.y + 30);
    await page.mouse.down();
    for (let step = 1; step <= 8; step += 1) await page.mouse.move(start.x, start.y + 30 - step * 8);
    await page.mouse.up();
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(40);
    // after the lift the dot stays where the finger left the screen, not where it went down
    const dot = frameOf(page).locator(".forgebook-touch-dot:not([hidden])");
    const lifted = await centreOf(dot);
    expect(Math.round(lifted.y)).toBe(Math.round(start.y + 30 - 64));
    const drawing = await centreOf(frameOf(page).getByRole("img", { name: "Drawing area" }));
    await page.mouse.move(drawing.x, drawing.y);
    await page.keyboard.down("Shift");
    // the second finger moves mirrored as the mouse moves, near Shift's centre as far from it, and stays put at the press
    const secondDot = frameOf(page).locator(".forgebook-touch-dot").nth(1);
    const secondX = async (): Promise<number> =>
      secondDot.evaluate((dot) => Number.parseFloat(dot.style.translate.split(" ")[0] ?? ""));
    await page.mouse.move(drawing.x + 10, drawing.y);
    const near = await secondX();
    await page.mouse.move(drawing.x + 20, drawing.y);
    expect(Math.round((await secondX()) - near)).toBe(-10);
    await page.mouse.move(drawing.x + 10, drawing.y);
    const before = await secondDot.evaluate((dot) => dot.style.translate);
    await page.mouse.down();
    expect(await secondDot.evaluate((dot) => dot.style.translate)).toBe(before);
    await page.mouse.up();
    await page.mouse.move(drawing.x + 40, drawing.y);
    await page.mouse.down();
    await page.mouse.move(drawing.x + 50, drawing.y + 4);
    await page.mouse.up();
    await page.keyboard.up("Shift");
    const entries = await eventLog(page);
    expect(entries).toContain("touchstart 2");
    expect(entries.filter((entry) => entry === "pointermove touch").length).toBeGreaterThanOrEqual(2);
  });

  test("the demos: a captured swipe, a carousel one photo a swipe, a sheet dragged, a pinch and a pull", async ({
    page
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const demo = (id: string): string => `/?story=kit:touch-demos-${id}&touch=touch`;
    const drag = async (from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let step = 1; step <= 12; step += 1)
        await page.mouse.move(from.x + ((to.x - from.x) * step) / 12, from.y + ((to.y - from.y) * step) / 12);
      await page.mouse.up();
    };
    // a row captures its pointer in its pointerdown, and a sideways swipe stays the row's on a pan-y list
    await page.goto(demo("swipe-list--inbox"));
    await frameStatus(page);
    const row = frameOf(page).locator(".swipe-row__content").first();
    const rowBox = await row.boundingBox();
    if (rowBox === null) throw new Error("the row is not drawn");
    await drag(
      { x: rowBox.x + rowBox.width - 30, y: rowBox.y + rowBox.height / 2 },
      { x: rowBox.x + rowBox.width - 200, y: rowBox.y + rowBox.height / 2 }
    );
    await expect(row).toHaveAttribute("style", /translate: -160px/);
    // a carousel snaps to the next photo, not past it
    await page.goto(demo("carousel--places"));
    await frameStatus(page);
    const track = frameOf(page).locator(".carousel__track");
    const trackBox = await track.boundingBox();
    if (trackBox === null) throw new Error("the carousel is not drawn");
    await drag(
      { x: trackBox.x + trackBox.width - 40, y: trackBox.y + 100 },
      { x: trackBox.x + 120, y: trackBox.y + 100 }
    );
    await expect
      .poll(() => track.evaluate((element) => element.scrollLeft / element.clientWidth))
      .toBeCloseTo(1, 1);
    // the sheet's handle drags it up from its peek (a quick drag flicks it past half)
    await page.goto(demo("bottom-sheet--nearby"));
    await frameStatus(page);
    const handle = await centreOf(frameOf(page).getByRole("button", { name: "Resize the sheet" }));
    await drag(handle, { x: handle.x, y: handle.y - 140 });
    await expect(frameOf(page).locator(".bottom-sheet__sheet")).toHaveAttribute("style", /height: (50|88)%/);
    // two fingers pinch the photo
    await page.goto(demo("photo-viewer--sunset"));
    await frameStatus(page);
    const stage = await centreOf(frameOf(page).getByRole("img", { name: "Sunset over the bay" }));
    await page.mouse.move(stage.x, stage.y);
    await page.keyboard.down("Shift");
    await page.mouse.move(stage.x + 40, stage.y);
    await drag({ x: stage.x + 40, y: stage.y }, { x: stage.x + 80, y: stage.y + 40 });
    await page.keyboard.up("Shift");
    await expect(frameOf(page).locator(".photo-viewer__readout span")).not.toHaveText("100% · 0°");
    // a feed pulled from its top refreshes
    await page.goto(demo("pull-to-refresh--friends"));
    await frameStatus(page);
    const feed = await centreOf(frameOf(page).locator(".pull-feed__list"));
    await drag({ x: feed.x, y: feed.y - 100 }, { x: feed.x, y: feed.y + 80 });
    await expect(frameOf(page).locator(".pull-feed__list li").first()).toHaveText(/^New post 1/);
    expect(errors).toEqual([]);
  });

  test("a story reads the Touch switch to draw only its version, and a story may fix touch", async ({
    page
  }) => {
    await page.goto("/?story=kit:interaction-touch-pad--by-pointer");
    await frameStatus(page);
    await expect(frameOf(page).getByText("Open the row's menu for its actions")).toBeVisible();
    await clickView(page);
    await popoversSettled(page);
    await page
      .getByRole("dialog", { name: "View" })
      .getByRole("group", { name: "Touch" })
      .getByRole("radio", { name: "Touch" })
      .check({ force: true });
    await expect(frameOf(page).getByText("Swipe the row for its actions")).toBeVisible();
    await page.goto("/?story=kit:interaction-touch-pad--touch-only");
    await frameStatus(page);
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-forgebook-touch", "touch");
  });

  test("a story marked for a phone starts in touch, with its own toggle on its example and its page", async ({
    page
  }) => {
    await page.goto("/?component=kit:touch-demos-swipe-list");
    const toggle = page.getByRole("switch", { name: "Touch Inbox with a finger", exact: true });
    await expect(toggle).toBeChecked();
    const demoFrame = page.locator("article", { has: toggle }).frameLocator("iframe.forgebook-frame-view");
    await expect(demoFrame.locator("html")).toHaveAttribute("data-forgebook-touch", "touch");
    // turned off in place: the frame keeps its story, and the address keeps the Touch switch the others follow
    await toggle.uncheck({ force: true });
    await expect(demoFrame.locator("html")).not.toHaveAttribute("data-forgebook-touch");
    await expect(page).not.toHaveURL(/touch=/);
    // its page follows the choice, and the Touch switch there is the story's own
    await page.getByRole("link", { name: "Open the story Inbox", exact: true }).click();
    await frameStatus(page);
    await expect(frameOf(page).locator("html")).not.toHaveAttribute("data-forgebook-touch");
    await clickView(page);
    await popoversSettled(page);
    await page
      .getByRole("dialog", { name: "View" })
      .getByRole("group", { name: "Touch" })
      .getByRole("radio", { name: "Touch" })
      .check({ force: true });
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-forgebook-touch", "touch");
    await expect(page).not.toHaveURL(/touch=/);
    // a story not marked follows the address: the mouse
    await page.goto("/?story=kit:interaction-touch-pad--by-pointer");
    await frameStatus(page);
    await expect(frameOf(page).locator("html")).not.toHaveAttribute("data-forgebook-touch");
  });

  test("the Touch switch says what is simulated, and the mouse comes back when it is off", async ({
    page
  }) => {
    await page.goto(touchPad());
    await frameStatus(page);
    await clickView(page);
    await popoversSettled(page);
    // the limits are a note on an info button, not a paragraph: shown on hover, in the menu and on the bar
    await page.getByRole("dialog", { name: "View" }).getByRole("button", { name: "About Touch" }).hover();
    await expect(
      page.getByRole("tooltip").filter({ hasText: /^Simulated: the story receives/ })
    ).toBeVisible();
    await page.getByRole("button", { name: "Pin Touch to the toolbar" }).click();
    // a full bar moves what has no room into View: wrapping keeps every pinned control on the bar
    await page
      .getByRole("switch", { name: "Wrap the toolbar onto more lines when it is full" })
      .check({ force: true });
    await expect(
      page
        .locator('.forgebook-toolbar__pinned[data-control="touch"]')
        .getByRole("button", { name: "About Touch" })
    ).toBeVisible();
    await page
      .getByRole("dialog", { name: "View" })
      .getByRole("group", { name: "Touch" })
      .getByRole("radio", { name: "Mouse" })
      .check({ force: true });
    await expect(frameOf(page).locator("html")).not.toHaveAttribute("data-forgebook-touch");
    await clickView(page);
    await expect(page.locator(".forgebook-popover")).toHaveCount(0);
    const button = await centreOf(frameOf(page).getByRole("button", { name: "Press me" }));
    await page.mouse.click(button.x, button.y);
    await expect.poll(async () => (await eventLog(page)).includes("click mouse")).toBe(true);
  });
});

test.describe("stories about logic", () => {
  test("a title's first segment makes a section, and a hook's entry and page are marked", async ({
    page
  }) => {
    await page.goto("/?component=kit:hooks-use-undo");
    await expect(page.getByRole("button", { name: /^Hooks/ })).toHaveAttribute("aria-expanded", "true");
    await expect(sidebarLinks(page).getByRole("link", { name: /^useUndo/ })).toContainText("Logic");
    await expect(page.locator(".forgebook-header .forgebook-logic-mark")).toHaveText("Logic");
    // its reference is the hook's call, not a props table
    const reference = page.getByRole("region", { name: "API reference" });
    await expect(reference.locator(".forgebook-signature__call")).toHaveText(
      "useUndo<TValue>(initial: TValue, limit?: number): UndoState<TValue>"
    );
    await expect(reference.locator("tbody th")).toContainText(["initial", "limit"]);
    await expect(reference).toContainText("the value now, and how to set, undo and redo it.");
  });

  test("its page opens on the signature, its play passes, and the bar keeps only what is not about looks", async ({
    page
  }) => {
    await page.goto("/?story=kit:hooks-use-undo--history&compare=theme");
    await frameStatus(page);
    // never compared, whatever the address says
    await expect(page.locator(".forgebook-compare")).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Signature" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: /Interactions/ })).toContainText("passed");
    // its scene takes no args: no tab sets or lists them
    await expect(page.getByRole("tab", { name: "Props" })).toHaveCount(0);
    const toolbar = page.locator(".forgebook-toolbar");
    await expect(toolbar.getByRole("button", { name: "Compare" })).toHaveCount(0);
    await expect(toolbar.locator('.forgebook-toolbar__pinned[data-control="theme"]')).toHaveCount(0);
    await expect(toolbar.locator('.forgebook-toolbar__pinned[data-control="width"]')).toHaveCount(1);
    // the address keeps its compare for the other stories
    await expect(page).toHaveURL(/compare=theme/);
  });
});

test.describe("the panel", () => {
  test("a value set in Props reaches the frame and stays in the address", async ({ page }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    await page.getByRole("radio", { name: "lg" }).check({ force: true });
    await expect(page).toHaveURL(/args=/);
    await expect(frameOf(page).locator("select")).toHaveAttribute("data-size", "lg");
    await page.reload();
    await frameStatus(page);
    await expect(frameOf(page).locator("select")).toHaveAttribute("data-size", "lg");
  });

  test("named views: the catalogue's picked, a reader's saved, kept after a reload, and removed", async ({
    page
  }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    const openView = async (): Promise<void> => {
      await clickView(page);
      await popoversSettled(page);
    };
    await openView();
    const views = page.getByRole("region", { name: "Views" });
    await views.getByRole("button", { name: "Dark phone" }).click();
    await expect(page).toHaveURL(/theme=dark/);
    await expect(page).toHaveURL(/width=360/);
    await expect(views.getByRole("button", { name: "Dark phone" })).toHaveAttribute("aria-pressed", "true");
    await views.getByRole("button", { name: "Save view…" }).click();
    await views.getByRole("textbox", { name: "View name" }).fill("Mine");
    await page.keyboard.press("Enter");
    await expect(views.getByRole("button", { name: "Mine", exact: true })).toBeVisible();
    await page.goto(story("overview"));
    await frameStatus(page);
    await openView();
    await views.getByRole("button", { name: "Mine", exact: true }).click();
    await expect(page).toHaveURL(/width=360/);
    await views.getByRole("button", { name: "Remove the view Mine" }).click();
    await expect(views.getByRole("button", { name: "Mine", exact: true })).toHaveCount(0);
  });

  test("a control's key cycles its values, and a reader gives it another in the View menu", async ({
    page
  }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    await page.keyboard.press("t");
    await expect(page).toHaveURL(/theme=/);
    const afterT = new URL(page.url()).searchParams.get("theme");
    await page.keyboard.press("Shift+T");
    await expect(page).not.toHaveURL(new RegExp(`theme=${afterT}`));
    await clickView(page);
    await popoversSettled(page);
    await page.getByRole("button", { name: "Theme: key T" }).click();
    await page.keyboard.press("c");
    // contrast has c: refused, said in place
    await expect(page.getByRole("status").filter({ hasText: "contrast's already" })).toBeVisible();
    await page.keyboard.press("y");
    await expect(page.getByRole("button", { name: "Theme: key Y" })).toBeVisible();
    await page.keyboard.press("Escape");
    await popoversSettled(page);
    await page.goto(story("overview"));
    await frameStatus(page);
    await page.keyboard.press("y");
    await expect(page).toHaveURL(/theme=/);
  });

  test("a dot marks a pinned control and a View row whose value is not the default", async ({ page }) => {
    await page.goto(story("overview", "theme=dark"));
    await frameStatus(page);
    await expect(page.getByRole("img", { name: "Theme: changed" })).toHaveCount(1);
    await clickView(page);
    await popoversSettled(page);
    await expect(page.getByRole("img", { name: "Theme: changed" })).toHaveCount(2);
    await page.goto(story("overview"));
    await frameStatus(page);
    await expect(page.getByRole("img", { name: "Theme: changed" })).toHaveCount(0);
  });

  test("the shell's appearance follows the system, a reader's choice stays after a reload, and the frames keep theirs", async ({
    page
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(story("overview"));
    await frameStatus(page);
    const root = page.locator("html");
    await expect(root).toHaveAttribute("data-forgebook-appearance", "dark");
    await page.getByRole("button", { name: "Appearance: System" }).click();
    await popoversSettled(page);
    await page
      .getByRole("dialog", { name: "Appearance" })
      .getByRole("radio", { name: "Light" })
      .check({ force: true });
    await expect(root).toHaveAttribute("data-forgebook-appearance", "light");
    await expect(page.getByRole("button", { name: "Appearance: Light" })).toBeVisible();
    await page.reload();
    await frameStatus(page);
    await expect(root).toHaveAttribute("data-forgebook-appearance", "light");
    // the story's look is the view's switches', never the shell's appearance
    await expect(frameOf(page).locator("html")).not.toHaveAttribute("data-forgebook-appearance");
  });

  test("Worst case fills the props with long texts and huge numbers, outlines the spills, and Reset undoes it", async ({
    page
  }) => {
    // narrow enough that the unbreakable word cannot fit
    await page.goto(story("overview", "width=320"));
    await frameStatus(page);
    const worst = page.getByRole("button", { name: "Worst case" });
    await worst.click();
    await expect(page).toHaveURL(/args=/);
    await expect(worst).toBeDisabled();
    // the hint takes a text: the long one, whose unbreakable word runs out of the story's root
    await expect(frameOf(page).locator("small")).toContainText("Supercalifragilisticexpialidocious");
    await expect(page.locator(".forgebook-tab-foot__note")).toHaveText(/^\d+ elements? spills?$/);
    await expect(frameOf(page).locator("[data-forgebook-spill]").first()).toBeAttached();
    await page.reload();
    await frameStatus(page);
    await expect(frameOf(page).locator("[data-forgebook-spill]").first()).toBeAttached();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page).not.toHaveURL(/args=/);
    await expect(worst).toBeEnabled();
    await expect(page.locator(".forgebook-tab-foot__note")).toHaveCount(0);
    await expect(frameOf(page).locator("[data-forgebook-spill]")).toHaveCount(0);
  });

  test("Code shows a story's render as written, and the JSX of a story drawn from its args", async ({
    page
  }) => {
    await page.goto(story("in-row", "tab=code"));
    await expect(page.locator(".forgebook-code-block")).toContainText(
      '<Select options={["weekly", "monthly"]}'
    );
    await page.goto(story("small", "tab=code"));
    await expect(page.locator(".forgebook-code-block")).toContainText('size="sm"');
  });

  test("Interactions lists the play's steps once it passed", async ({ page }) => {
    await page.goto(story("played", "tab=play"));
    await expect(page.getByRole("tab", { name: /Interactions/ })).toContainText("passed");
    await expect(page.locator(".forgebook-play__label")).toHaveText(["find the select", "read its value"]);
  });

  test("Accessibility checks the story as it is now", async ({ page }) => {
    await page.goto(story("overview", "tab=a11y"));
    await frameStatus(page);
    await page.getByRole("button", { name: "Check the story" }).click();
    await expect(page.getByRole("tab", { name: /Accessibility/ })).toContainText(/passes|problem/);
  });
});
