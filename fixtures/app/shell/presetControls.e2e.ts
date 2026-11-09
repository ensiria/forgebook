/**
 * A control a library's preset registers for a type, on a real page: the kit's icon picker (`@fixture/kit/forgebook`)
 * takes every prop typed `IconComponent` in every story that names no control for it, draws each icon with its name,
 * turns the name into the icon in the frame, and loads only when a story shows such a prop.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

/** The chip's story: a label, and two icon props, one typed through an alias. */
const CHIP = "/?story=kit:actions-chip--basic";

/** The icon button's story, whose own args give it an icon. */
const BUTTON = "/?story=kit:actions-icon-button--basic";

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/** A prop's icon picker, by the prop's name. */
const pickerOf = (page: Page, prop: string) => page.getByRole("group", { name: `${prop}: icon` });

/** The addresses of the picker's modules, in the shell or in a frame. */
const PICKER_MODULES = /icon-picker|iconPicker|icon-value|iconValue/;

test.describe("a preset's control by type", () => {
  test("takes both icon props of a story with no argTypes, each icon drawn with its name", async ({
    page
  }) => {
    await page.goto(CHIP);
    for (const prop of ["startIcon", "endIcon"]) {
      const picker = pickerOf(page, prop);
      await expect(picker.getByRole("radio")).toHaveCount(7);
      // the preset words its "none"; each icon is named, and drawn beside its name
      await expect(picker.getByRole("radio", { name: "No icon" })).toBeChecked();
      await expect(picker.getByRole("radio", { name: "IconStar" })).toBeVisible();
      await expect(picker.locator('[data-icon="IconStar"]')).toBeVisible();
    }
  });

  test("gives the story the icon it names, and the link the name", async ({ page }) => {
    await page.goto(CHIP);
    await pickerOf(page, "startIcon").getByRole("radio", { name: "IconStar" }).check();
    await expect(frameOf(page).locator('[data-icon="IconStar"]')).toBeVisible();
    expect(new URL(page.url()).searchParams.get("args")).toBe('{"startIcon":"IconStar"}');
    await pickerOf(page, "startIcon").getByRole("radio", { name: "No icon" }).check();
    await expect(frameOf(page).locator("[data-icon]")).toHaveCount(0);
  });

  test("takes a link's name, and leaves out one the picker does not offer", async ({ page }) => {
    await page.goto(`${CHIP}&args=${encodeURIComponent('{"endIcon":"IconHeart","startIcon":"IconNope"}')}`);
    await expect(frameOf(page).locator('[data-icon="IconHeart"]')).toBeVisible();
    await expect(pickerOf(page, "endIcon").getByRole("radio", { name: "IconHeart" })).toBeChecked();
    await expect(page.getByText("its control refuses it")).toBeVisible();
  });

  test("shows the icon the story gives itself, and goes back to it", async ({ page }) => {
    await page.goto(BUTTON);
    const picker = pickerOf(page, "icon");
    await expect(picker.getByRole("radio", { name: "IconSearch" })).toBeChecked();
    await picker.getByRole("radio", { name: "IconHeart" }).check();
    await expect(frameOf(page).locator('[data-icon="IconHeart"]')).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(frameOf(page).locator('[data-icon="IconSearch"]')).toBeVisible();
    await expect(pickerOf(page, "icon").getByRole("radio", { name: "IconSearch" })).toBeChecked();
  });

  test("is reached and used with the keyboard", async ({ page }) => {
    await page.goto(CHIP);
    const none = pickerOf(page, "startIcon").getByRole("radio", { name: "No icon" });
    await expect(none).toBeChecked();
    await page.getByRole("textbox", { name: "label" }).focus();
    // the next stop after the label's field and its button is the picker's chosen option
    for (
      let step = 0;
      step < 4 && !(await none.evaluate((element) => element === document.activeElement));
      step++
    )
      await page.keyboard.press("Tab");
    await expect(none).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(pickerOf(page, "startIcon").getByRole("radio", { name: "IconSearch" })).toBeChecked();
    await expect(frameOf(page).locator('[data-icon="IconSearch"]')).toBeVisible();
  });

  test("leaves a prop whose story's argTypes name a control to that control", async ({ page }) => {
    await page.goto("/?story=kit:actions-icon-button--own-control");
    await expect(page.getByRole("radio", { name: "Heart" })).toBeVisible();
    await expect(pickerOf(page, "icon")).toHaveCount(0);
    await page.getByRole("radio", { name: "Heart" }).check({ force: true });
    await expect(frameOf(page).locator('[data-icon="IconHeart"]')).toBeVisible();
  });

  test("adds nothing to a story without such a prop, and loads nothing there", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto("/?story=kit:inputs-selection-select--overview");
    await expect(page.getByRole("textbox", { name: "value" })).toBeVisible();
    await expect(page.locator('[data-control="icon"]')).toHaveCount(0);
    expect(requests.filter((url) => PICKER_MODULES.test(url))).toEqual([]);
    await page.goto(CHIP);
    await expect(pickerOf(page, "startIcon").getByRole("radio")).toHaveCount(7);
    expect(requests.filter((url) => PICKER_MODULES.test(url)).length).toBeGreaterThan(0);
  });

  test("reaches agents as a custom control with its schema, and checks the names they set", async ({
    request
  }) => {
    const query = new URLSearchParams({
      id: "kit:actions-chip--basic",
      args: JSON.stringify({ startIcon: "IconStar", endIcon: "IconNope" })
    });
    const answer: unknown = await (await request.get(`/__forgebook/api/story?${query}`)).json();
    expect(answer).toMatchObject({
      controls: [
        { name: "label", control: "text" },
        {
          name: "startIcon",
          control: "custom",
          custom: "icon",
          type: "ChipIcon",
          schema: { type: "string" }
        },
        { name: "endIcon", control: "custom", custom: "icon", type: "IconComponent" }
      ],
      problems: [expect.stringContaining('"endIcon" was left out')]
    });
    expect(answer).toHaveProperty(
      ["story", "links", "address"],
      expect.stringContaining(encodeURIComponent('{"startIcon":"IconStar"}'))
    );
  });

  test("writes a picked icon in the story's code as the icon, as the story receives it", async ({
    page,
    request
  }) => {
    await page.goto(CHIP);
    await pickerOf(page, "startIcon").getByRole("radio", { name: "IconStar" }).check();
    await expect(frameOf(page).locator('[data-icon="IconStar"]')).toBeVisible();
    await page.getByRole("tab", { name: "Code" }).click();
    const code = page.getByRole("tabpanel", { name: "Code" });
    await expect(code).toContainText("startIcon={IconStar}");
    await expect(code).not.toContainText('"IconStar"');
    // the story file's own code for its icon stays as written
    await page.goto(`${BUTTON}&args=${encodeURIComponent('{"label":"Find"}')}`);
    await page.getByRole("tab", { name: "Code" }).click();
    await expect(page.getByRole("tabpanel", { name: "Code" })).toContainText("icon={IconSearch}");
    const query = new URLSearchParams({ id: "kit:actions-chip--basic", args: '{"endIcon":"IconHeart"}' });
    const answer: unknown = await (await request.get(`/__forgebook/api/story?${query}`)).json();
    expect(answer).toHaveProperty("code", '<Chip label="Filter" endIcon={IconHeart} />');
  });
});
