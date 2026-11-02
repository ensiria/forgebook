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
    // inside the safe areas: the status bar and the home indicator take 59 and 34 px of the 852
    expect(await frameSize(page)).toEqual({ width: 393, height: 759 });
    // the device control says what is shown; the width's presets are only widths, off while the device sets it
    await expect(page.getByRole("combobox", { name: "Device", exact: true })).toHaveValue("iphone-16");
    await expect(page.getByRole("radio", { name: "Fill" })).toBeDisabled();
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
    await page.getByRole("combobox", { name: "Device", exact: true }).selectOption("pixel-9");
    await expect(page).toHaveURL(/forgebook\.device=pixel-9/);
    expect(await frameSize(page)).toEqual({ width: 412, height: 923 - 48 - 24 });
    await page.getByRole("button", { name: "Turn the device" }).click();
    await expect(page).toHaveURL(/forgebook\.orientation=landscape/);
    expect(await frameSize(page)).toEqual({ width: 923 - 48, height: 412 - 24 - 16 });
    await page.getByRole("combobox", { name: "Device", exact: true }).selectOption({ label: "No frame" });
    await expect(page).toHaveURL(/forgebook\.device=off/);
    await expect(page.locator(".forgebook-device[data-framed]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Turn the device" })).toHaveCount(0);
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
    await expect(page.getByRole("combobox", { name: "Device", exact: true })).toHaveValue("off");
    expect(chunks).toEqual([]);
    await page
      .getByRole("combobox", { name: "Device", exact: true })
      .selectOption({ label: "Generic phone" });
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

    // the toolbar shows a device while a story is framed by default, and No frame shows every story without one
    const control = page.getByRole("combobox", { name: "Device", exact: true });
    await expect(control).toHaveValue("iphone-16");
    await control.selectOption({ label: "No frame" });
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

  test("a story in a device is touched as a phone is, the reader can turn that off, and a device may say no", async ({
    page
  }) => {
    const html = page.frameLocator(".forgebook-story iframe.forgebook-frame-view").locator("html");
    await page.goto(screen("phone"));
    await ready(page);
    await expect(html).toHaveAttribute("data-forgebook-touch", "touch");
    await expect(page).not.toHaveURL(/touch=/);
    // the reader turns it off for the story, here on its example; the frame stays
    await page.goto("/?component=kit:layouts-app-screen");
    const toggle = page.getByRole("switch", { name: "Touch Phone with a finger", exact: true });
    await expect(toggle).toBeChecked();
    const demo = page.locator("article", { has: toggle });
    await expect(demo.frameLocator("iframe.forgebook-frame-view").locator("html")).toHaveAttribute(
      "data-forgebook-touch",
      "touch"
    );
    await toggle.uncheck({ force: true });
    await expect(demo.frameLocator("iframe.forgebook-frame-view").locator("html")).not.toHaveAttribute(
      "data-forgebook-touch"
    );
    await expect(demo.locator(".forgebook-device[data-framed]")).toHaveCount(1);
    // without its frame, a story not marked for a phone follows the address: the mouse
    await page.goto(screen("phone", "forgebook.device=off"));
    await ready(page);
    await expect(html).not.toHaveAttribute("data-forgebook-touch");
    // a device that says `touch: false` keeps the mouse
    await page.goto(screen("mouse"));
    await ready(page);
    await expect(page.locator(".forgebook-device[data-framed]")).toHaveCount(1);
    await expect(html).not.toHaveAttribute("data-forgebook-touch");
  });

  test("the device control sits in the View menu beside Touch, as the other controls do", async ({
    page
  }) => {
    await page.goto(screen("phone"));
    await page.getByRole("button", { name: /^View/ }).click();
    const rows = await page
      .locator(".forgebook-arrange")
      .evaluateAll((each) => each.map((row) => (row as HTMLElement).dataset["control"] ?? ""));
    expect(rows.indexOf("forgebook.device")).toBeGreaterThanOrEqual(0);
  });

  test("a story sits below the status bar by default, and one drawn edge to edge is told the safe areas", async ({
    page
  }) => {
    /** Where the story's frame starts in its device's screen, and the safe area its root is told. */
    const placed = async (): Promise<{ top: number; told: string }> => {
      await ready(page);
      const top = await page.evaluate(() => {
        const screen = document.querySelector(".forgebook-story .forgebook-device__screen");
        const frame = screen?.querySelector("iframe");
        return (frame?.getBoundingClientRect().top ?? 0) - (screen?.getBoundingClientRect().top ?? 0);
      });
      const told = await page
        .frameLocator(".forgebook-story iframe.forgebook-frame-view")
        .locator("html")
        .evaluate((html) => getComputedStyle(html).getPropertyValue("--forgebook-safe-area-top"));
      return { top: Math.round(top), told };
    };
    await page.goto("/?story=kit:layouts-form--signup&panel=closed&forgebook.device=iphone-16");
    expect(await placed()).toEqual({ top: 59, told: "" });
    await page.goto(screen("edge-to-edge"));
    expect(await placed()).toEqual({ top: 0, told: "59px" });
    expect(await frameSize(page)).toEqual({ width: 393, height: 852 });
    // the status bar over a story drawn edge to edge never takes its pointer
    const top = await storyFrame(page).evaluate((frame) => {
      const box = frame.getBoundingClientRect();
      return document.elementFromPoint(box.left + 60, box.top + 20)?.tagName;
    });
    expect(top).toBe("IFRAME");
  });
});
