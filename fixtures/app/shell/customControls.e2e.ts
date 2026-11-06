/**
 * Custom controls on a real page: registered by name, loaded on use, their values checked both ways, and each way one can
 * fail told beside its field with the panel still working.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

/** The story with every control. */
const STORY = "/?story=sb:storybook-custom-controls--rated";

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/** What the story received. */
const received = async (page: Page): Promise<Record<string, unknown>> =>
  JSON.parse((await frameOf(page).getByTestId("args").textContent()) ?? "{}") as Record<string, unknown>;

test.describe("custom controls", () => {
  test("mounts with the story's value and settings, and its changes reach the story and the link", async ({
    page
  }) => {
    await page.goto(STORY);
    const rating = page.locator('[data-control="rating"]');
    await expect(rating.getByRole("button")).toHaveCount(7);
    await expect(rating.getByRole("button", { name: "3 of 7" })).toHaveAttribute("aria-pressed", "true");
    await rating.getByRole("button", { name: "5 of 7" }).click();
    await expect.poll(() => received(page)).toMatchObject({ rating: 5 });
    expect(new URL(page.url()).searchParams.get("args")).toBe('{"rating":5}');
    // it keeps what it draws: the button pressed still has the focus
    await expect(rating.getByRole("button", { name: "5 of 7" })).toBeFocused();
    await page.reload();
    await expect.poll(() => received(page)).toMatchObject({ rating: 5 });
    await expect(
      page.locator('[data-control="rating"]').getByRole("button", { name: "5 of 7" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("is mounted again when the value changes from outside", async ({ page }) => {
    await page.goto(`${STORY}&args=${encodeURIComponent('{"rating":6}')}`);
    const rating = page.locator('[data-control="rating"]');
    await expect(rating.getByRole("button", { name: "6 of 7" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "rating: back to the story's value" }).click();
    await expect(rating.getByRole("button", { name: "4 of 7" })).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => received(page)).toMatchObject({ rating: 3 });
  });

  test("is mounted again by Reset after its own change, and a Storybook link's value is typed for it", async ({
    page
  }) => {
    await page.goto(STORY);
    const rating = page.locator('[data-control="rating"]');
    await rating.getByRole("button", { name: "5 of 7" }).click();
    await expect.poll(() => received(page)).toMatchObject({ rating: 5 });
    await page.getByRole("button", { name: "rating: back to the story's value" }).click();
    await expect.poll(() => received(page)).toMatchObject({ rating: 3 });
    await expect(rating.getByRole("button", { name: "4 of 7" })).toHaveAttribute("aria-pressed", "false");
    await page.goto(`${STORY}&args=rating:6`);
    await expect.poll(() => received(page)).toMatchObject({ rating: 6 });
  });

  test("an embed checks a control's value against its schema", async ({ page }) => {
    await page.goto(
      `/?embed&story=sb:storybook-custom-controls--rated&args=${encodeURIComponent('{"rating":99,"title":"kept"}')}`
    );
    await expect.poll(() => received(page)).toMatchObject({ rating: 3, title: "kept" });
    await expect(page.getByRole("alert")).toContainText("rating");
  });

  test("checks a link's value against the schema before it reaches the story", async ({ page }) => {
    await page.goto(`${STORY}&args=${encodeURIComponent('{"rating":99,"title":"kept"}')}`);
    await expect.poll(() => received(page)).toMatchObject({ rating: 3, title: "kept" });
    await expect(page.getByText("its control refuses it")).toBeVisible();
  });

  test("says each way a control fails beside its field, and the panel goes on working", async ({ page }) => {
    await page.goto(STORY);
    const alert = (name: string, text: string | RegExp) =>
      page
        .locator(".forgebook-prop", { has: page.locator(".forgebook-prop__name", { hasText: name }) })
        .getByRole("alert")
        .filter({ hasText: text });
    await expect(alert("failing", "this control always fails")).toBeVisible();
    await expect(alert("gone", /could not be loaded/)).toBeVisible();
    await expect(alert("unschemed", /must export mount/)).toBeVisible();
    await expect(alert("nobody", 'No control is registered as "nobody"')).toBeVisible();
    await page.getByRole("textbox", { name: "title" }).fill("still works");
    await expect.poll(() => received(page)).toMatchObject({ title: "still works" });
  });

  test("refuses what a control gives against its own schema, and says so", async ({ page }) => {
    await page.goto(STORY);
    await page.getByRole("button", { name: "Give a number" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "must be of type string" })).toBeVisible();
    expect(await received(page)).not.toHaveProperty("wrong");
  });

  test("a story that names none loads no control's code", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto("/?story=sb:storybook-value-props--filled");
    await expect(page.getByRole("button", { name: "Add to tags" })).toBeVisible();
    expect(requests.filter((url) => /controls\/|CustomControl|customControls/.test(url))).toEqual([]);
  });
});
