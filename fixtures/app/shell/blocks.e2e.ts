/**
 * A docs page's blocks in the browser, on the fixture's page that holds every one (`kit/docs/blocks.md`): asides and
 * alerts, tabs that share their choice, steps, cards, and code with its title, its marked lines and what it copies.
 *
 * @module
 */
import { expect, type Page, test } from "@playwright/test";

/** The page of every block. */
const BLOCKS = "/?page=kit:blocks";

/** The page's scrolling element, scrolled until an element is near. */
const reach = async (page: Page, selector: string): Promise<void> => {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
};

test.describe("docs blocks", () => {
  test("draws each aside with its tone and title, and each GitHub alert as the aside its colour says", async ({
    page
  }) => {
    await page.goto(BLOCKS);
    const asides = page.locator(".forgebook-aside");
    await expect(asides).toHaveCount(10);
    await expect(asides.locator(".forgebook-aside__title")).toHaveText([
      "Note",
      "A tip with its own title",
      "Important",
      "Caution",
      "Danger",
      "Note",
      "Tip",
      "Important",
      "Caution",
      "Danger"
    ]);
    const tones = await asides.evaluateAll((each) => each.map((aside) => aside.getAttribute("data-tone")));
    expect(tones.slice(5)).toEqual(["note", "tip", "important", "caution", "danger"]);
    await expect(page.getByRole("complementary", { name: "Danger" }).first()).toContainText("what breaks");
  });

  test("draws a story inside an aside and inside a step", async ({ page }) => {
    await page.goto(BLOCKS);
    const inAside = page.getByRole("complementary", { name: "A tip with its own title" }).locator("iframe");
    await expect(inAside.contentFrame().locator("html")).toHaveAttribute("data-forgebook-status", "ready");
    await reach(page, ".forgebook-steps");
    await expect(page.locator(".forgebook-steps__step")).toHaveCount(3);
    const inStep = page.locator(".forgebook-steps__step").nth(2).locator("iframe");
    await expect(inStep.contentFrame().locator("html")).toHaveAttribute("data-forgebook-status", "ready");
  });

  test("tabs with the same name switch together, move with the arrow keys, and keep the choice", async ({
    page
  }) => {
    await page.goto(BLOCKS);
    const lists = page.getByRole("tablist");
    await expect(lists).toHaveCount(2);
    await lists.first().getByRole("tab", { name: "npm", exact: true }).click();
    await expect(lists.nth(1).getByRole("tab", { name: "npm", exact: true })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(
      page.getByRole("tabpanel").filter({ hasText: "npm installs in each project." })
    ).toBeVisible();
    await expect(page.getByText("pnpm keeps one store for every project.")).toBeHidden();
    await page.keyboard.press("ArrowLeft");
    await expect(lists.first().getByRole("tab", { name: "pnpm", exact: true })).toBeFocused();
    await expect(lists.nth(1).getByRole("tab", { name: "pnpm", exact: true })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.keyboard.press("End");
    await page.reload();
    await expect(
      page.getByRole("tablist").first().getByRole("tab", { name: "npm", exact: true })
    ).toHaveAttribute("aria-selected", "true");
  });

  test("a link card opens its page at the heading it names", async ({ page }) => {
    await page.goto(BLOCKS);
    await reach(page, ".forgebook-cards");
    await expect(page.locator(".forgebook-card")).toHaveCount(3);
    await page
      .getByRole("link", { name: /Theming/ })
      .filter({ hasText: "The guide behind both cards." })
      .click();
    await expect(page).toHaveURL(/page=kit%3Aguides-theming#more-contrast$/);
    await expect(page.locator('[id="doc-more-contrast"]')).toBeInViewport();
  });

  test("code shows its title and its marked lines, and copies what it reads after the change", async ({
    page,
    context
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(BLOCKS);
    const titled = page.locator(".forgebook-docs__code", { hasText: "Period.tsx" });
    await reach(page, ".forgebook-docs__code-title");
    await expect(titled.locator(".forgebook-docs__code-title")).toHaveText("Period.tsx");
    await expect(titled.locator("mark.forgebook-code-line")).toContainText("export const Period");
    await expect(titled.locator("ins.forgebook-code-line")).toContainText('"monthly"');
    await expect(titled.locator("del.forgebook-code-line")).toHaveCount(1);
    await titled.getByRole("button", { name: "Copy" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('"monthly"');
    expect(copied).not.toContain('options={["weekly"]}');
    const diff = page
      .locator(".forgebook-docs__code")
      .filter({ has: page.locator("del", { hasText: '"md"' }) });
    await expect(diff.locator(".forgebook-hl-keyword").first()).toHaveText("import");
    const wrapped = page.locator('.forgebook-docs__code[data-wrap="true"] pre');
    expect(
      await wrapped.evaluate((element) => element.scrollWidth - element.clientWidth)
    ).toBeLessThanOrEqual(0);
  });
});
