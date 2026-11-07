/**
 * The sidebar's tag filter in the browser: offered from the stories' tags, kept in the address and from page to page,
 * and loaded only when it is offered.
 *
 * @module
 */
import { expect, type Locator, type Page, test } from "@playwright/test";

/** The filter's button, whatever it says of the tags on. */
const filterButton = (page: Page): Locator => page.getByRole("button", { name: /^Filter by tag/ });

/** The filter's panel. */
const panel = (page: Page): Locator => page.getByRole("dialog", { name: "Tags" });

/** The sidebar's tree. */
const tree = (page: Page): Locator => page.getByRole("navigation", { name: "Components" });

test.describe("the tag filter", () => {
  test("asks for a tag, keeps it in the address and in a link's page", async ({ page }) => {
    await page.goto("/");
    await filterButton(page).click();
    await expect(panel(page).getByRole("checkbox")).toHaveCount(3);
    await expect(panel(page).getByRole("checkbox", { name: /autodocs|dev|test/ })).toHaveCount(0);
    await panel(page).getByRole("checkbox", { name: /beta/ }).check();
    await expect(page).toHaveURL(/[?&]tag=beta/);
    await expect(tree(page).getByRole("link", { name: /^Button/ })).toBeVisible();
    await expect(tree(page).getByRole("link")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(filterButton(page)).toHaveAttribute("aria-label", "Filter by tag: 1 on");
    await tree(page)
      .getByRole("link", { name: /^Button/ })
      .click();
    await expect(page).toHaveURL(/component=.*[?&]?tag=beta/);
  });

  test("an address with a tag opens filtered, and a leave-out narrows it", async ({ page }) => {
    await page.goto("/?tag=beta&tag=%21wip");
    await expect(tree(page).getByRole("link")).toHaveCount(1);
    await filterButton(page).click();
    await expect(panel(page).getByRole("checkbox", { name: /beta/ })).toBeChecked();
    await expect(panel(page).getByRole("button", { name: "Leave out wip" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await panel(page).getByRole("button", { name: "Clear the filter" }).click();
    await expect(page).not.toHaveURL(/tag=/);
    await expect(tree(page).getByRole("link")).not.toHaveCount(1);
  });

  test("a story the filter leaves out still opens by its address", async ({ page }) => {
    await page.goto("/?tag=stable&story=sb:components-button--primary");
    await expect(page.getByRole("heading", { name: "Button", level: 1 })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("the story keys walk what the filter keeps", async ({ page }) => {
    await page.goto("/?tag=beta&story=sb:components-button--primary");
    await expect(page.getByRole("heading", { name: "Button", level: 1 })).toBeVisible();
    await expect(tree(page).getByRole("link")).toHaveCount(1);
    await page.keyboard.press("]");
    await expect(page).toHaveURL(/story=.*--secondary/);
    await page.keyboard.press("]");
    await expect(page).toHaveURL(/story=.*--secondary/);
  });
});
