/**
 * The search across the catalogue in the browser, on the fixture app: the index loaded on first use, a prop and a
 * sentence found, the keys, and going to the exact heading or prop.
 *
 * @module
 */
import { expect, type Locator, type Page, test } from "@playwright/test";

/** The list of results. */
const results = (page: Page): Locator => page.getByRole("listbox", { name: "Search results" });

/** A row of the results, by what it says. */
const row = (page: Page, text: string | RegExp): Locator =>
  results(page).getByRole("option").filter({ hasText: text });

test.describe("the search", () => {
  test("keeps the row a person chose while later answers change the list, and Enter opens it", async ({
    page
  }) => {
    // the answer of the stories' index comes last, once a person has moved through the list the names give
    let release = (): void => undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/forgebook-search:/, async (route) => {
      await released;
      await route.continue();
    });
    await page.goto("/");
    await page.getByRole("searchbox").focus();
    await page.keyboard.type("select overview");
    const options = results(page).getByRole("option");
    await expect(options.nth(1)).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    const href = await options.nth(1).getAttribute("href");
    release();
    await expect(page.locator(".forgebook-search-panel[data-ready]")).toBeVisible({ timeout: 30_000 });
    await expect(results(page).locator('[aria-selected="true"]')).toHaveAttribute("href", href ?? "");
    await page.keyboard.press("Enter");
    await expect(results(page)).toBeHidden();
    expect(new URL(page.url()).search).toBe(href);
  });

  test("a key pressed before the list has caught up with the words acts on the list of those words", async ({
    page
  }) => {
    await page.goto("/");
    const box = page.getByRole("searchbox");
    await box.fill("select");
    await expect(page.locator(".forgebook-search-panel[data-ready]")).toBeVisible({ timeout: 30_000 });
    await expect(results(page).getByRole("option").first()).toHaveAttribute(
      "href",
      /guides-choosing-a-select/
    );
    // the words and the keys in one task: the list drawn for the new words cannot come in between
    await box.evaluate((field: HTMLInputElement) => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(field, "select overview");
      field.dispatchEvent(new Event("input", { bubbles: true }));
      for (const key of ["ArrowDown", "Enter"])
        field.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    });
    await expect(page).toHaveURL(/[?&]story=kit%3Ainputs-selection-select--overview/);
  });

  test("new words start from the first row again", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox").focus();
    await page.keyboard.type("select");
    await expect(page.locator(".forgebook-search-panel[data-ready]")).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.type(" overview");
    await expect(row(page, "Overview").first()).toBeVisible();
    await expect(results(page).getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  });

  test("loads nothing before it is used, and its index only when something is typed", async ({ page }) => {
    const asked: string[] = [];
    page.on("request", (request) => asked.push(decodeURIComponent(request.url())));
    await page.goto("/");
    await expect(page.getByRole("searchbox")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(asked.filter((url) => url.includes("SearchPanel"))).toEqual([]);
    await page.getByRole("searchbox").focus();
    await expect.poll(() => asked.filter((url) => url.includes("SearchPanel")).length).toBeGreaterThan(0);
    await page.waitForLoadState("networkidle");
    expect(asked.filter((url) => url.includes("forgebook-search"))).toEqual([]);
    await page.getByRole("searchbox").fill("select");
    await expect
      .poll(() => asked.filter((url) => url.includes("forgebook-search")).length)
      .toBeGreaterThan(0);
  });

  test("finds a prop by name, says what it is, and opens at its row with the focus on it", async ({
    page
  }) => {
    await page.goto("/");
    await expect(page.getByRole("searchbox")).toBeVisible();
    await page.keyboard.press("/");
    await page.keyboard.type("onValueChange");
    const hit = row(page, "Called with the new value");
    // the first search on a dev server waits for the package's TypeScript program
    await expect(hit).toContainText("Event", { timeout: 30_000 });
    await expect(hit.locator("mark").first()).toBeVisible();
    await hit.click();
    await expect(page).toHaveURL(/component=kit%3Ainputs-selection-select#prop\.onValueChange/);
    const prop = page.locator('[data-prop="onValueChange"]');
    await expect(prop).toBeInViewport();
    await expect(prop).toBeFocused();
    await expect(results(page)).toBeHidden();
    // the search stays: the tree still shows what the words leave
    await expect(page.getByRole("searchbox")).toHaveValue("onValueChange");
  });

  test("finds a sentence of a docs page and opens at its heading", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox").fill("the reader picks the shell's appearance");
    const hit = row(page, "Light and dark");
    await expect(hit).toContainText("Text");
    await expect(hit.locator("mark")).toHaveText("The reader picks the shell's appearance");
    await page.keyboard.press("ArrowDown");
    await expect(hit).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/page=kit%3Aguides-theming#light-and-dark/);
    await expect(page.locator('[id="doc-light-and-dark"]')).toBeInViewport();
    await expect(page.locator('[id="doc-light-and-dark"]').getByRole("link")).toBeFocused();
  });

  test("opens at a heading of a component's documentation file", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox").fill("accessibility");
    await row(page, "Heading").first().click();
    await expect(page).toHaveURL(/component=.*#accessibility/);
    await expect(page.locator('[id="doc-accessibility"]')).toBeInViewport();
  });

  test("opens a story found by its description", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox").fill("default select");
    // the first search on a dev server waits for the package's TypeScript program, and the rows move when it comes
    await expect(page.locator(".forgebook-search-panel[data-ready]")).toBeVisible({ timeout: 30_000 });
    await row(page, /^Story.*The default select/)
      .first()
      .click();
    await expect(page).toHaveURL(/story=kit%3Ainputs-selection-select--overview/);
  });

  test("the keys move through the rows, wrap, and name the row to the field", async ({ page }) => {
    await page.goto("/");
    const field = page.getByRole("searchbox");
    await field.fill("value");
    // the whole index first: its arrival brings new rows, above the first one too
    await expect(page.locator(".forgebook-search-panel[data-ready]")).toBeVisible({ timeout: 30_000 });
    const options = results(page).getByRole("option");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await expect(field).toHaveAttribute(
      "aria-activedescendant",
      (await options.first().getAttribute("id")) ?? ""
    );
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await expect(options.last()).toHaveAttribute("aria-selected", "true");
    await expect(field).toBeFocused();
    // new words start at the best result
    await field.fill("select");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
  });

  test("Escape empties the field and closes the list; a press outside closes it and keeps the words", async ({
    page
  }) => {
    await page.goto("/");
    const field = page.getByRole("searchbox");
    await field.fill("value");
    await expect(results(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(field).toHaveValue("");
    await expect(results(page)).toBeHidden();
    await field.fill("value");
    await expect(results(page)).toBeVisible();
    await page.locator(".forgebook-main").click({ position: { x: 900, y: 500 } });
    await expect(results(page)).toBeHidden();
    await expect(field).toHaveValue("value");
    await field.focus();
    await expect(results(page)).toBeVisible();
  });

  test("the tree goes on filtering beside the results", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox").fill("select");
    await expect(results(page)).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Components" });
    await nav
      .getByRole("link", { name: /^Select/ })
      .first()
      .click();
    await expect(page).toHaveURL(/component=kit%3Ainputs-selection-select/);
    await expect(results(page)).toBeHidden();
  });

  test("says when nothing is found, and what a near result lacks", async ({ page }) => {
    await page.goto("/");
    const field = page.getByRole("searchbox");
    await field.fill("zzzqqq");
    await expect(page.getByRole("status").filter({ hasText: "Nothing found" })).toContainText("zzzqqq");
    await field.fill("select zzzqqq");
    await expect(page.locator(".forgebook-result__note").first()).toContainText("Without: zzzqqq");
  });

  test("its search key reaches the field from a hidden sidebar, and a press with the key opens a new tab", async ({
    page,
    context
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Hide the sidebar" }).click();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("searchbox")).toBeFocused();
    await page.keyboard.type("value");
    await expect(row(page, "Called with the new value")).toBeVisible();
    const opened = context.waitForEvent("page");
    await row(page, "Called with the new value").click({ modifiers: ["ControlOrMeta"] });
    // the new tab opens on a blank page first, then goes to the result
    await (await opened).waitForURL(/prop\.onValueChange/);
    await expect(results(page)).toBeVisible();
  });

  test("fits a phone, under the field", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");
    await page.getByRole("button", { name: "Show the sidebar" }).click();
    await page.getByRole("searchbox").fill("value");
    const box = await page.locator(".forgebook-search-panel").boundingBox();
    const field = await page.locator(".forgebook-search").boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(360);
    expect(box?.y).toBeGreaterThanOrEqual((field?.y ?? 0) + (field?.height ?? 0));
  });

  test("agents get the same answer from the same index", async ({ request }) => {
    const answer = await request.get("/__forgebook/api/search?query=onValueChange&limit=1");
    expect(answer.ok()).toBe(true);
    expect(await answer.json()).toMatchObject({
      schema: 1,
      query: "onValueChange",
      results: [
        {
          kind: "component",
          id: "kit:inputs-selection-select",
          hits: expect.arrayContaining([
            expect.objectContaining({
              kind: "event",
              name: "onValueChange",
              address: expect.stringMatching(/#prop\.onValueChange$/)
            })
          ])
        }
      ],
      problems: []
    });
  });

  test("an address with a prop opens there", async ({ page }) => {
    await page.goto("/?component=kit:inputs-selection-select#prop.value");
    await expect(page.locator('[data-prop="value"]')).toBeInViewport();
  });
});
