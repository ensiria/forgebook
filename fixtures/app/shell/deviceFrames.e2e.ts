/**
 * Device frames in the browser, on the fixture app: a story framed by default and one that is not, the toggle, the
 * model and the turn in the address, the story kept while the frame comes and goes, the component's page, the compare
 * view, and the frame's chunk loaded only when a device is shown.
 *
 * @module
 */
import { expect, type Page, test } from "@playwright/test";

/** The address of a story of the fixture's app screen, framed in an iPhone 16 by its meta. */
const screen = (name: string, query = ""): string =>
  `/?story=kit:layouts-app-screen--${name}&panel=closed${query === "" ? "" : `&${query}`}`;

/** The shown story's frame. */
const storyFrame = (page: Page) => page.locator(".forgebook-story iframe.forgebook-frame-view");

/** The size of the shown story's frame, in CSS px. */
const frameSize = async (page: Page): Promise<{ width: number; height: number }> =>
  storyFrame(page).evaluate((frame) => ({ width: frame.clientWidth, height: frame.clientHeight }));

/** Waits until the shown story's frame says it is ready. */
const ready = async (page: Page): Promise<void> => {
  await expect
    .poll(() =>
      page
        .frameLocator(".forgebook-story iframe.forgebook-frame-view")
        .locator("html")
        .getAttribute("data-forgebook-status")
    )
    .toBe("ready");
};

test.describe("device frames", () => {
  test.use({ viewport: { width: 1600, height: 1000 } });

  test("a story framed by its meta shows the device at the model's viewport, the width set by it", async ({
    page
  }) => {
    await page.goto(screen("phone"));
    await expect(page.locator(".forgebook-device[data-framed]")).toHaveAttribute("data-model", "iphone-16");
    await ready(page);
    expect(await frameSize(page)).toEqual({ width: 393, height: 852 });
    const toggle = page.getByRole("button", { name: "Device frame" });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("combobox", { name: "Device" })).toHaveValue("iphone-16");
    await expect(page.getByRole("textbox", { name: "Width in px" })).toBeDisabled();
    await expect(page.getByRole("textbox", { name: "Width in px" })).toHaveValue("393");
    // the status bar and the camera's cut never take the story's pointer
    const top = await storyFrame(page).evaluate((frame) => {
      const box = frame.getBoundingClientRect();
      return document.elementFromPoint(box.left + 60, box.top + 20)?.tagName;
    });
    expect(top).toBe("IFRAME");
  });

  test("the toggle, the model and the turn reach the address, and the story keeps its document", async ({
    page
  }) => {
    await page.goto(screen("phone"));
    await ready(page);
    await page
      .frameLocator(".forgebook-story iframe.forgebook-frame-view")
      .locator("html")
      .evaluate((html) => html.setAttribute("data-kept", "yes"));
    await page.getByRole("combobox", { name: "Device" }).selectOption("pixel-9");
    await expect(page).toHaveURL(/forgebook\.device=pixel-9/);
    expect(await frameSize(page)).toEqual({ width: 412, height: 923 });
    await page.getByRole("button", { name: "Turn the device" }).click();
    await expect(page).toHaveURL(/forgebook\.orientation=landscape/);
    expect(await frameSize(page)).toEqual({ width: 923, height: 412 });
    await page.getByRole("button", { name: "Device frame" }).click();
    await expect(page).toHaveURL(/forgebook\.device=off/);
    await expect(page.locator(".forgebook-device[data-framed]")).toHaveCount(0);
    // the frame stayed mounted throughout: the same document, the attribute set above still on it
    await expect(
      page.frameLocator(".forgebook-story iframe.forgebook-frame-view").locator("html")
    ).toHaveAttribute("data-kept", "yes");
  });

  test("a story that sets nothing stays unframed and loads none of the device's parts, until asked", async ({
    page
  }) => {
    const chunks: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("deviceParts")) chunks.push(request.url());
    });
    await page.goto("/?story=kit:inputs-selection-select--overview&panel=closed");
    await ready(page);
    await expect(page.locator(".forgebook-device[data-framed]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Device frame" })).toHaveAttribute("aria-pressed", "false");
    expect(chunks).toEqual([]);
    await page.getByRole("button", { name: "Device frame" }).click();
    await expect(page).toHaveURL(/forgebook\.device=phone/);
    await expect(page.locator(".forgebook-device[data-framed]")).toHaveAttribute("data-model", "phone");
    expect(chunks.length).toBeGreaterThan(0);
  });

  test("the component's page honours each story's own device, and compare frames every cell (the theme at both contrasts)", async ({
    page
  }) => {
    await page.goto("/?component=kit:layouts-app-screen");
    const examples = page.locator(".forgebook-example");
    await expect(examples.first().locator(".forgebook-device[data-framed]")).toHaveAttribute(
      "data-model",
      "iphone-16"
    );
    const unframed = examples.filter({ has: page.getByRole("heading", { name: "Unframed" }) });
    await unframed.scrollIntoViewIfNeeded();
    await expect(unframed.locator(".forgebook-device")).not.toHaveAttribute("data-framed");
    const turned = examples.filter({ has: page.getByRole("heading", { name: "Pixel landscape" }) });
    await turned.scrollIntoViewIfNeeded();
    await expect(turned.locator(".forgebook-device[data-framed]")).toHaveAttribute(
      "data-orientation",
      "landscape"
    );

    // the toolbar reads on while a story is framed by default, and turning it off shows every story without one
    const toggle = page.getByRole("button", { name: "Device frame" });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(page).toHaveURL(/forgebook\.device=off/);
    await expect(page.locator(".forgebook-example .forgebook-device[data-framed]")).toHaveCount(0);

    await page.goto(screen("phone", "compare=theme"));
    await expect(page.locator(".forgebook-compare__cell .forgebook-device[data-framed]")).toHaveCount(4);
  });

  test("the hardware takes the shell's appearance", async ({ page }) => {
    await page.goto(screen("phone"));
    const body = page.locator('.forgebook-device__layer[data-layer="under"] rect').last();
    const light = await body.getAttribute("fill");
    await page.evaluate(() => document.documentElement.setAttribute("data-forgebook-appearance", "dark"));
    await expect(body).not.toHaveAttribute("fill", light ?? "");
  });
});
