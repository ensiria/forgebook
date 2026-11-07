/**
 * The statuses in the browser: a meta's status as a badge in the sidebar and on its component's page, a story's own
 * beside its example, a status written as `parameters.status`, a component deprecated in its TSDoc only, and the tag
 * filter showing a status as its badge.
 *
 * @module
 */
import { expect, type Locator, type Page, test } from "@playwright/test";

/** The sidebar's tree. */
const tree = (page: Page): Locator => page.getByRole("navigation", { name: "Components" });

/** A component's entry in the sidebar, its family opened. */
const entry = async (page: Page, name: RegExp): Promise<Locator> => {
  const family = tree(page).getByRole("button", { name: /^Touch demos/ });
  if ((await family.getAttribute("aria-expanded")) === "false") await family.click();
  return tree(page).getByRole("link", { name });
};

test.describe("the statuses", () => {
  test("a meta's status shows in its sidebar entry and at the top of its page, named for a screen reader", async ({
    page
  }) => {
    await page.goto("/?component=kit:touch-demos-carousel");
    await expect(page.getByRole("heading", { name: "Carousel", level: 1 })).toBeVisible();
    await expect(await entry(page, /^Carousel/)).toHaveAccessibleName(/^Carousel\s*Status: Review/);
    await expect(page.locator(".forgebook-doc .forgebook-status-badges--page")).toHaveText("Status: Review");
    await expect(await entry(page, /^Pull to refresh/)).toHaveAccessibleName(/Status: Deprecated/);
    await expect(await entry(page, /^Bottom sheet/)).not.toHaveAccessibleName(/Status/);
  });

  test("a story's own status shows beside its example, and a TSDoc's deprecation on the page", async ({
    page
  }) => {
    await page.goto("/?component=kit:touch-demos-swipe-list");
    const badges = page.locator(".forgebook-doc .forgebook-status-badges--page .forgebook-status");
    await expect(badges).toHaveText("Deprecated");
    await expect(badges).toHaveAttribute("title", /Deprecated in its TSDoc: Use a list with a menu/);
    await expect(page.getByRole("heading", { name: /^Inbox touch\s*Status: Experimental/ })).toBeVisible();
    // the sidebar reads tags only: the TSDoc is the agents' to report (`get_story`'s problems)
    await expect(await entry(page, /^Swipe list/)).not.toHaveAccessibleName(/Status/);
  });

  test("a status written as parameters.status, the status addons' way, reads as a tag", async ({ page }) => {
    await page.goto("/?component=sb:storybook-status-addon");
    await expect(page.locator(".forgebook-doc .forgebook-status-badges--page")).toHaveText(
      "Status: Experimental"
    );
    await expect(page.getByRole("heading", { name: /^In review\s*Status: Review/ })).toBeVisible();
    await expect(
      tree(page).getByRole("link", { name: /^Status addon\s*Status: Experimental/ })
    ).toBeVisible();
  });

  test("the tag filter shows a status as its badge, and filters by it", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Filter by tag/ }).click();
    const panel = page.getByRole("dialog", { name: "Tags" });
    await panel.getByRole("checkbox", { name: /Review/ }).check();
    await expect(page).toHaveURL(/[?&]tag=review/);
    // the carousel's meta and the status addon's story hold it
    await expect(tree(page).getByRole("link")).toHaveCount(2);
    await expect(tree(page).getByRole("link", { name: /^Carousel/ })).toBeVisible();
    await expect(tree(page).getByRole("link", { name: /^Status addon/ })).toBeVisible();
  });
});
