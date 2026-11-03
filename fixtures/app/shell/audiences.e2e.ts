/**
 * Who a component's page is read by, on the fixture app: the default page untouched, each audience's sections and code,
 * the address, the frames that stay loaded, the View menu's control, the check of every story, and a narrow window.
 *
 * @module
 */
import { expect, type Page, test } from "@playwright/test";

/** The fixture's documented component. */
const SELECT = "/?component=kit:inputs-selection-select";

/** The page's column. */
const column = (page: Page) => page.locator(".forgebook-doc");

/** The second-level headings of the page, in their order. */
const headings = (page: Page) => column(page).locator("h2");

/** Opens the View menu. */
const openView = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: /^View/ }).click();
};

test.describe("audiences of a component's page", () => {
  test("leaves the page as it was for everyone: no note, no new section, the code closed", async ({
    page
  }) => {
    await page.goto(SELECT);
    await expect(headings(page).first()).toHaveText("Accessibility");
    await expect(headings(page)).toHaveText(["Accessibility", "API reference", "Examples", "Used in"]);
    await expect(column(page)).not.toHaveAttribute("data-audience", /.*/);
    await expect(page.locator(".forgebook-audience-note")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show code" }).first()).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(page.url()).not.toContain("audience");
  });

  test("gives a designer the guidance first, a larger demo, no code, docs pages and tokens", async ({
    page
  }) => {
    await page.goto(`${SELECT}&audience=designer`);
    await expect(headings(page)).toHaveText([
      "When to use it",
      "Accessibility",
      "Read more",
      "Design tokens",
      "Examples",
      "Used in"
    ]);
    await expect(page.getByText("The list is short and its values are known.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Show code" })).toHaveCount(0);
    await expect(column(page).locator("pre")).toHaveCount(0);
    const demo = page.locator(".forgebook-example[data-demo] iframe");
    await expect.poll(async () => (await demo.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(360);
    const tokens = page.getByRole("region", { name: "Design tokens" });
    await expect(tokens.getByRole("rowheader", { name: "select.border" })).toBeVisible();
    await expect(tokens.getByText("dark: #b28bff").first()).toBeVisible();
    await expect(tokens.getByRole("rowheader", { name: "color.accent" })).toBeHidden();
    // the catalogue's own tokens and those its sources declare
    await tokens.getByText("6 tokens of the whole catalogue").click();
    await expect(tokens.getByRole("rowheader", { name: "color.accent" })).toBeVisible();
  });

  test("asks for a designer's tokens and usage without waiting for the audience's sections", async ({
    page
  }) => {
    // the sections' code held back: their data must already be on its way
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/AudienceSections\.tsx/, async (route) => {
      await held;
      await route.continue();
    });
    const tokens = page.waitForRequest(/virtual:forgebook\/tokens/);
    const usage = page.waitForRequest(/virtual:forgebook-usage:/);
    await page.goto(`${SELECT}&audience=designer`);
    await Promise.all([tokens, usage]);
    release();
    const tokensSection = page.getByRole("region", { name: "Design tokens" });
    await expect(tokensSection.getByRole("rowheader", { name: "select.border" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Used in" })).toBeVisible();
  });

  test("opens a docs page from a designer's page, keeping the audience in the address", async ({ page }) => {
    await page.goto(`${SELECT}&audience=designer`);
    await page.getByRole("region", { name: "Read more" }).getByRole("link", { name: "Theming" }).click();
    await expect(page).toHaveURL(/page=kit%3Aguides-theming/);
    await expect(page).toHaveURL(/audience=designer/);
    await page.goBack();
    await expect(headings(page).first()).toHaveText("When to use it");
  });

  test("gives a coder the API first and every example's code open", async ({ page }) => {
    await page.goto(`${SELECT}&audience=coder`);
    await expect(headings(page).first()).toHaveText("API reference");
    await expect(headings(page).nth(1)).toHaveText("Parts and styling");
    await expect(page.getByRole("button", { name: "Hide code" }).first()).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    await page.getByRole("button", { name: "Hide code" }).first().click();
    await expect(page.getByRole("button", { name: "Show code" }).first()).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  test("gives a tester what the stories cover, and checks them all", async ({ page }) => {
    await page.goto(`${SELECT}&audience=tester`);
    await expect(headings(page).first()).toHaveText("What the stories cover");
    const coverage = page.getByRole("region", { name: "What the stories cover" });
    await expect(coverage.getByText("9 stories: 1 with a play function")).toBeVisible();
    await expect(coverage.getByRole("row", { name: /^Played/ })).toContainText("Plays");
    await expect(coverage.getByRole("row", { name: /^Small/ })).toContainText("States");
    await expect(page.getByRole("heading", { name: "API reference" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Accessibility", level: 2 })).toBeVisible();
    await expect(coverage.getByRole("row", { name: /^Small/ })).toContainText("Not checked");
    await coverage.getByRole("button", { name: "Check every story" }).click();
    await expect(coverage.getByRole("status")).toHaveText("9 of 9 checked", { timeout: 60_000 });
    await expect(coverage.getByRole("row", { name: /^Small/ })).toContainText(/passes|problem/);
    await expect(coverage.getByRole("row", { name: /^Throws/ })).toContainText("Could not load");
    await expect(page.locator(".forgebook-example iframe")).toHaveCount(9);
  });

  test("loads another component's frames as they come near again after a check", async ({ page }) => {
    await page.goto(`${SELECT}&audience=tester`);
    const related = page.getByRole("navigation", { name: "Related" });
    await related.getByRole("link", { name: "Page" }).click();
    await page.getByRole("button", { name: "Check every story" }).click();
    await expect(page.getByRole("status").filter({ hasText: "checked" })).toBeVisible();
    await page.getByRole("navigation", { name: "Related" }).getByRole("link", { name: "Select" }).click();
    await expect(headings(page).first()).toHaveText("What the stories cover");
    await expect(page.getByRole("button", { name: "Check every story" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "checked" })).toHaveCount(0);
    await expect(page.locator(".forgebook-example iframe")).not.toHaveCount(9);
  });

  test("changes audience from the View menu without loading a frame again", async ({ page }) => {
    await page.goto(SELECT);
    const frame = page.frameLocator(".forgebook-example[data-demo] iframe");
    await expect(frame.locator("html")).toHaveAttribute("data-forgebook-status", "ready");
    await frame.locator("html").evaluate((root) => root.setAttribute("data-kept", ""));
    await openView(page);
    await page.getByLabel("Reading for", { exact: true }).selectOption("coder");
    await expect(page).toHaveURL(/audience=coder/);
    await expect(headings(page).first()).toHaveText("API reference");
    await page.getByLabel("Reading for", { exact: true }).selectOption("designer");
    await expect(headings(page).first()).toHaveText("When to use it");
    await expect(frame.locator("html")).toHaveAttribute("data-kept", "");
    await expect(page.getByRole("button", { name: /^View/ }).getByRole("img")).toBeVisible();
  });

  test("keeps the frames' addresses free of the audience", async ({ page }) => {
    await page.goto(`${SELECT}&audience=tester`);
    await expect(page.locator(".forgebook-example[data-demo] iframe")).toHaveAttribute(
      "src",
      /^(?!.*audience).*story=/
    );
  });

  test("goes back to the whole page from its note, the focus kept in the page", async ({ page }) => {
    await page.goto(`${SELECT}&audience=designer`);
    await page.getByRole("button", { name: "Show everything" }).focus();
    await page.keyboard.press("Enter");
    await expect(headings(page).first()).toHaveText("Accessibility");
    expect(page.url()).not.toContain("audience");
    await expect(page.locator(".forgebook-scroll")).toBeFocused();
  });

  test("offers the audience only where it changes something", async ({ page }) => {
    await page.goto("/?story=kit:inputs-selection-select--small");
    await openView(page);
    await expect(page.getByLabel("Reading for", { exact: true })).toBeDisabled();
  });

  test("fits a phone's width without the page scrolling sideways", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${SELECT}&audience=tester`);
    await page.getByRole("button", { name: "Hide the sidebar" }).click();
    await expect(headings(page).first()).toHaveText("What the stories cover");
    const scroll = page.locator(".forgebook-scroll");
    await expect
      .poll(() => scroll.evaluate((element) => element.scrollWidth - element.clientWidth))
      .toBeLessThanOrEqual(0);
  });
});
