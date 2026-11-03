/**
 * Docs pages in the browser, on the fixture app: the sidebar's section and the home, a page with its live stories
 * following the view, its contents and anchors, its links, its code, the agent-visible address, and the narrow layout.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

/** A docs page's address. */
const docs = (id: string, query = ""): string => `/?page=${id}${query}`;

/** The first page of the fixture: three live stories. */
const STARTED = docs("kit:getting-started");

/** The page's scrolling element. */
const scroller = (page: Page) => page.locator(".forgebook-scroll");

/** A frame of the page, by its place. */
const frameAt = (page: Page, place: number): FrameLocator =>
  page.frameLocator("iframe.forgebook-frame-view").nth(place);

/** Scrolls the page until all its lazily loaded frames came near, then waits for each to be ready. */
const reachEveryFrame = async (page: Page, count: number): Promise<void> => {
  await expect
    .poll(async () => {
      await scroller(page).evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      return page.locator("iframe.forgebook-frame-view").count();
    })
    .toBe(count);
  for (let place = 0; place < count; place += 1) {
    await expect(frameAt(page, place).locator("html")).toHaveAttribute("data-forgebook-status", "ready");
  }
};

/** Waits until a heading's smooth scroll is over: its position holds for two checks. */
const scrollSettled = async (page: Page): Promise<void> => {
  let last = -1;
  await expect
    .poll(async () => {
      const top = await scroller(page).evaluate((element) => element.scrollTop);
      const isStill = top === last;
      last = top;
      return isStill;
    })
    .toBe(true);
};

test.describe("docs pages", () => {
  test("lists the pages above the components, in reading order, each library named", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Components" });
    await expect(nav.locator("h2").first()).toHaveText("Docs");
    const docsSection = nav.locator("section").first();
    await expect(docsSection.locator(".forgebook-tree__docs-source")).toHaveText([
      "Fixture kit",
      "Storybook stories"
    ]);
    await expect(docsSection.locator(".forgebook-tree__item-name")).toHaveText([
      "Getting started",
      "Theming",
      "Choosing a select",
      "Writing for the kit",
      "About these stories"
    ]);
  });

  test("opens from the home's card and from the sidebar, as a new entry of the history", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("region", { name: "Fixture kit" })
      .getByRole("article", { name: "Docs" })
      .getByRole("link", { name: "Theming" })
      .click();
    await expect(page).toHaveURL(/page=kit%3Aguides-theming/);
    await expect(page.locator("h1")).toHaveText("Theming");
    await expect(page.locator(".forgebook-header__path")).toHaveText("Fixture kit · Guides");
    await expect(page).toHaveTitle("Theming · Fixture catalogue");
    const nav = page.getByRole("navigation", { name: "Components" });
    await expect(nav.getByRole("link", { name: "Theming" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Getting started" }).click();
    await expect(page.locator("h1")).toHaveText("Getting started");
    await page.goBack();
    await expect(page.locator("h1")).toHaveText("Theming");
    // the home's recent pages know a docs page too
    await page.locator(".forgebook-brand__home").click();
    await expect(page.locator(".forgebook-home__recent-link").first()).toContainText("Theming");
  });

  test("the search finds a page by its description", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox").fill("every prop");
    const nav = page.getByRole("navigation", { name: "Components" });
    await expect(nav.getByRole("link", { name: "Choosing a select" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Getting started" })).toHaveCount(0);
  });

  test("draws three live stories, lazily, each following the switches", async ({ page }) => {
    await page.goto(STARTED);
    await expect(page.locator(".forgebook-doc__lead code")).toHaveText("Select");
    await reachEveryFrame(page, 3);
    for (const place of [0, 1, 2]) {
      await expect(frameAt(page, place).locator("html")).not.toHaveAttribute("data-theme", "dark");
    }
    await page.getByRole("radio", { name: "Dark", exact: true }).first().click({ force: true });
    await expect(page).toHaveURL(/theme=dark/);
    for (const place of [0, 1, 2]) {
      await expect(frameAt(page, place).locator("html")).toHaveAttribute("data-theme", "dark");
    }
    // the page's own address and heading survive the change of view
    await expect(page).toHaveURL(/page=kit%3Agetting-started/);
  });

  test("a frame loads only as it comes near", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 200 });
    await page.goto(STARTED);
    await expect(frameAt(page, 0).locator("html")).toHaveAttribute("data-forgebook-status", "ready");
    await expect(page.locator("iframe.forgebook-frame-view")).not.toHaveCount(3);
    await reachEveryFrame(page, 3);
  });

  test("a component's table comes from its types", async ({ page }) => {
    await page.goto(docs("kit:guides-choosing-a-select"));
    await expect(page.locator(".forgebook-api__table").first()).toContainText("options");
  });

  test("a story's bar opens its page, and shows its code", async ({ page }) => {
    await page.goto(docs("kit:guides-choosing-a-select"));
    const example = page.locator(".forgebook-example").first();
    await example.getByRole("button", { name: "Show code" }).click();
    await expect(example.locator(".forgebook-example__code")).toContainText("<Select");
    await example.getByRole("link", { name: /Open/ }).click();
    await expect(page).toHaveURL(/story=kit%3Ainputs-selection-select--in-row/);
  });

  test("the contents go to a heading, mark it as it is read, and keep it in the address", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 600 });
    await page.goto(docs("kit:guides-choosing-a-select"));
    const contents = page.getByRole("navigation", { name: "On this page" });
    await expect(contents.getByRole("link")).toHaveText([
      "In a row",
      "The props",
      "Filler to scroll past",
      "A step further",
      "The last section"
    ]);
    await contents.getByRole("link", { name: "The last section" }).click();
    await expect(page).toHaveURL(/#the-last-section$/);
    await expect(page.locator('[id="doc-the-last-section"]')).toBeInViewport();
    await expect(contents.getByRole("link", { name: "The last section" })).toHaveAttribute(
      "aria-current",
      "location"
    );
    await expect(page.locator('[id="doc-the-last-section"] a')).toBeFocused();
    // a change of the view keeps the fragment
    await page.getByRole("radio", { name: "Dark", exact: true }).first().click({ force: true });
    await expect(page).toHaveURL(/theme=dark.*#the-last-section$/);
    await page.goBack();
    await expect(page).not.toHaveURL(/#the-last-section$/);
  });

  test("opens at a heading named in the address, frames above it loading", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(docs("kit:guides-choosing-a-select", "#the-last-section"));
    await expect(page.locator('[id="doc-the-last-section"]')).toBeInViewport();
    await page.reload();
    await expect(page.locator('[id="doc-the-last-section"]')).toBeInViewport();
  });

  test("a heading links to itself", async ({ page }) => {
    await page.goto(docs("kit:guides-theming"));
    await page.locator('[id="doc-more-contrast"] a').click();
    await expect(page).toHaveURL(/#more-contrast$/);
    // two headings of one name keep apart
    await expect(page.locator('[id="doc-light-and-dark-1"]')).toHaveCount(1);
  });

  test("its links open in place: another page, a heading, a component", async ({ page }) => {
    await page.goto(`${STARTED}&theme=dark`);
    const text = page.locator(".forgebook-docs__body");
    const guide = text.getByRole("link", { name: "choosing a select" });
    await expect(guide).toHaveAttribute("href", /theme=dark.*page=kit%3Aguides-choosing-a-select#in-a-row$/);
    await page.evaluate(() => Reflect.set(window, "forgebookKept", true));
    await guide.click();
    await expect(page.locator("h1")).toHaveText("Choosing a select");
    await expect(page.locator('[id="doc-in-a-row"]')).toBeInViewport();
    await page.goBack();
    await expect(page.locator("h1")).toHaveText("Getting started");
    await text.getByRole("link", { name: "the install" }).click();
    await expect(page).toHaveURL(/#install$/);
    await text.getByRole("link", { name: "the component's page" }).click();
    await expect(page).toHaveURL(/component=kit/);
    expect(await page.evaluate(() => Reflect.get(window, "forgebookKept"))).toBe(true);
  });

  test("another site opens in a new tab, and an image comes from the build", async ({ page }) => {
    await page.goto(STARTED);
    await expect(page.getByRole("link", { name: "Forgebook repository" })).toHaveAttribute(
      "target",
      "_blank"
    );
    await page.goto(docs("kit:guides-theming"));
    const image = page.getByRole("img", { name: "The kit's mark" });
    await expect.poll(() => image.evaluate((each: HTMLImageElement) => each.naturalWidth)).toBeGreaterThan(0);
  });

  test("code is coloured at build time, and copied with its button", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(STARTED);
    const code = page.locator(".forgebook-docs__code").nth(1);
    await expect(code.locator(".forgebook-hl-keyword").first()).toHaveText("import");
    await code.getByRole("button", { name: "Copy" }).click();
    await expect(code.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("@fixture/kit/select");
  });

  test("walks to the pages around it", async ({ page }) => {
    await page.goto(STARTED);
    const foot = page.locator(".forgebook-docs__foot");
    await expect(foot.locator("[data-side]")).toHaveCount(1);
    await foot.getByRole("link", { name: /Next/ }).click();
    await expect(page.locator("h1")).toHaveText("Theming");
    await foot.getByRole("link", { name: /Previous/ }).click();
    await expect(page.locator("h1")).toHaveText("Getting started");
  });

  test("a page with no story has no toolbar of switches", async ({ page }) => {
    await page.goto(docs("kit:writing-for-the-kit"));
    await expect(page.locator(".forgebook-docs .forgebook-prose")).toContainText("A page with no story");
    await expect(page.getByRole("button", { name: "View" })).toHaveCount(0);
  });

  test("Back from a heading returns to where the reader was; the same heading again goes back to it", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 600 });
    await page.goto(docs("kit:guides-choosing-a-select"));
    const contents = page.getByRole("navigation", { name: "On this page" });
    const last = page.locator('[id="doc-the-last-section"]');
    await contents.getByRole("link", { name: "The last section" }).click();
    await expect(last).toBeInViewport();
    await scrollSettled(page);
    await scroller(page).evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(last).not.toBeInViewport();
    const entries = await page.evaluate(() => window.history.length);
    await contents.getByRole("link", { name: "The last section" }).click();
    await expect(last).toBeInViewport();
    await scrollSettled(page);
    expect(await page.evaluate(() => window.history.length)).toBe(entries);
    await page.goBack();
    await expect(page).not.toHaveURL(/#the-last-section$/);
    await expect.poll(() => scroller(page).evaluate((element) => element.scrollTop)).toBe(0);
  });

  test("a link to a heading of another page arrives at it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto(`${STARTED}`);
    await page.locator(".forgebook-docs__body").getByRole("link", { name: "choosing a select" }).click();
    await expect(page.locator("h1")).toHaveText("Choosing a select");
    await expect(page.locator('[id="doc-in-a-row"]')).toBeInViewport();
  });

  test("the next page's frames load though this page's never finished", async ({ page }) => {
    await page.route("**/frame.html*", (route) =>
      route.request().url().includes("overview") ? undefined : route.continue()
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(STARTED);
    await page
      .getByRole("navigation", { name: "Components" })
      .getByRole("link", { name: "Choosing a select" })
      .click();
    await expect(page.locator("h1")).toHaveText("Choosing a select");
    await expect(frameAt(page, 0).locator("html")).toHaveAttribute("data-forgebook-status", "ready");
  });

  test("the dev server reads no file outside what it serves, whatever the query", async ({ request }) => {
    for (const query of ["forgebook-docs-page", "forgebook-markdown"]) {
      const answer = await request.get(`/@fs/etc/hosts?import&${query}`);
      expect(await answer.text()).not.toContain("127.0.0.1");
    }
  });

  test("a page that is not there says so", async ({ page }) => {
    await page.goto(docs("kit:gone"));
    await expect(page.getByRole("alert")).toContainText('No page "kit:gone"');
  });

  test("the contents fold above the text on a narrow page, which never scrolls sideways", async ({
    page
  }) => {
    await page.setViewportSize({ width: 360, height: 700 });
    await page.goto(docs("kit:guides-theming"));
    await page.getByRole("button", { name: "Hide the sidebar" }).click();
    const fold = page.locator("details.forgebook-contents");
    await expect(fold).toBeVisible();
    await expect(fold.getByRole("link", { name: "More contrast" })).toBeHidden();
    await fold.locator("summary").click();
    await fold.getByRole("link", { name: "More contrast" }).click();
    await expect(page).toHaveURL(/#more-contrast$/);
    const overflow = await scroller(page).evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("the shell's theme reaches the page, in both appearances", async ({ page }) => {
    await page.goto(STARTED);
    const link = page.locator(".forgebook-docs__around-name").first();
    // the fixture's `accent-text` for the light appearance
    await expect(link).toHaveCSS("color", "rgb(90, 42, 160)");
    await page.evaluate(() => document.documentElement.setAttribute("data-forgebook-appearance", "dark"));
    await expect(link).not.toHaveCSS("color", "rgb(90, 42, 160)");
    const body = page.locator(".forgebook-docs .forgebook-prose").first();
    await expect(body).toHaveCSS("color", "rgb(242, 242, 244)");
  });
});
