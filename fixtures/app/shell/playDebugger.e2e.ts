/**
 * The step debugger in the browser: Interactions logs a play's actions through its context's tools, and "Step through"
 * stops before each one until told.
 *
 * @module
 */
import { expect, type Page, test } from "@playwright/test";

/** A story pressed once with the context's canvas and userEvent. */
const STORY = "/?story=sb:storybook-play--with-context&tab=play";

/** The Interactions tab's button. */
const tab = (page: Page) => page.getByRole("tab", { name: /Interactions/ });

test.describe("the play's log and its step debugger", () => {
  test("logs what the play did through its context's tools", async ({ page }) => {
    await page.goto(STORY);
    await expect(tab(page)).toContainText("passed");
    const actions = page.locator(".forgebook-play__action .forgebook-play__label");
    await expect(actions).toHaveText([/^canvas\.getByRole\("button"\)$/, /^userEvent\.click\(<button>/]);
  });

  test("steps through a play, the story waiting at each action", async ({ page }) => {
    await page.goto(STORY);
    await expect(tab(page)).toContainText("passed");
    const button = page.frameLocator("iframe.forgebook-frame-view").getByRole("button");
    await expect(button).toHaveText("Pressed 1");
    await page.getByRole("button", { name: "Step through" }).click();
    await expect(page.getByRole("status").filter({ hasText: /^Next: userEvent\.click/ })).toBeVisible();
    await expect(button).toHaveText("Pressed 0");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(tab(page)).toContainText("passed");
    await expect(button).toHaveText("Pressed 1");
    await expect(page.getByRole("button", { name: "Run again" })).toBeEnabled();
  });

  test("Continue runs the rest without stopping", async ({ page }) => {
    await page.goto("/?story=sb:storybook-play--with-storybook-test&tab=play");
    await expect(tab(page)).toContainText("passed");
    await page.getByRole("button", { name: "Step through" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Next: press twice" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(tab(page)).toContainText("passed");
    await expect(page.getByRole("button", { name: "Step through" })).toBeEnabled();
  });
});
