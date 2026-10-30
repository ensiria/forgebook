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
    await library.getByRole("link", { name: "Select" }).click();
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
});

test.describe("aliases and related pages (D-492)", () => {
  test("an alias entry in another place opens the same page, which says where the component lives", async ({
    page
  }) => {
    await page.goto("/?component=kit:foundations-page");
    const tree = page.getByRole("navigation", { name: "Components" });
    await tree.getByRole("button", { name: /^Forms/ }).click();
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

test.describe("a story's declared height (D-469)", () => {
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

  test("the handle at the story's foot sets its height from the declared one, and a double click gives it back (note 142)", async ({
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
    await expect
      .poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentDocument?.body !== null))
      .toBe(true);
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

  test("the frame says it loads until its story is ready", async ({ page }) => {
    await page.goto(story("overview"));
    await frameStatus(page);
    await expect(page.getByRole("status").filter({ hasText: "Loading the story" })).toHaveCount(0);
  });

  test("the sidebar never lists stories: they are picked in the header", async ({ page }) => {
    await page.goto(story("overview"));
    // Inputs is open (the shown component's family), Foundations closed: one link, the component's, none for a story
    await expect(page.getByRole("navigation", { name: "Components" }).getByRole("link")).toHaveText([
      /^Select\d+$/
    ]);
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
      "Light · more contrast",
      "Dark · more contrast"
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
