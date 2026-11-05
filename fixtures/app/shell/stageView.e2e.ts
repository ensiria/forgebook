/**
 * The view a story's frame is sent: a story whose height moves renders the stage at every report, which must neither send
 * the frame a view nor draw the story again, while a view that did change still reaches it.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";
import type { LiveView } from "forgebook/view-state";

/** The address of the story whose height keeps moving. */
const GROWING = "/?story=kit:foundations-growing-box--growing";

/** The attribute of a window's root that holds how many messages of a kind it received. */
const countAttribute = (type: string): string => `data-test-${type.replace(":", "-")}`;

/** The views a frame received are counted on its root, and the heights the shell received on its own. */
const countMessages = async (page: Page): Promise<void> => {
  await page.addInitScript(
    (attributes: Readonly<Record<string, string>>) => {
      window.addEventListener("message", (event: MessageEvent<unknown>) => {
        const message = event.data;
        if (typeof message !== "object" || message === null) return;
        const type = Reflect.get(message, "type");
        const attribute = typeof type === "string" ? attributes[type] : undefined;
        if (attribute === undefined) return;
        const root = document.documentElement;
        root.setAttribute(attribute, String(Number(root.getAttribute(attribute) ?? "0") + 1));
        if (type === "forgebook:view")
          root.setAttribute(`${attribute}-last`, JSON.stringify(Reflect.get(message, "view")));
      });
    },
    {
      "forgebook:view": countAttribute("forgebook:view"),
      "forgebook:size": countAttribute("forgebook:size")
    }
  );
};

/** The shown story's frame; on a component's page, its first story's. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view").first();

/** How many times the shown story was drawn. */
const drawsOf = async (page: Page): Promise<number> =>
  Number(await frameOf(page).getByRole("status", { name: "Draws" }).textContent());

/** How many views the shown story's frame received. */
const viewsOf = async (page: Page): Promise<number> =>
  Number((await frameOf(page).locator("html").getAttribute(countAttribute("forgebook:view"))) ?? "0");

/** How many heights the shell received. */
const heightsOf = async (page: Page): Promise<number> =>
  Number((await page.locator("html").getAttribute(countAttribute("forgebook:size"))) ?? "0");

/**
 * Waits until the shell has received more heights.
 *
 * @param page - the page.
 * @param count - how many more.
 */
const heightsMoved = async (page: Page, count: number): Promise<void> => {
  const heightsAtStart = await heightsOf(page);
  await expect.poll(() => heightsOf(page), { timeout: 15_000 }).toBeGreaterThan(heightsAtStart + count);
};

/**
 * The draws once the frame's start is over: on `ready` the shell sends it its events, args and matrix, a few draws
 * that do not depend on the height, and everything after them comes from what a test does.
 */
const drawsOnceStarted = async (page: Page): Promise<number> => {
  await expect(frameOf(page).locator("html")).toHaveAttribute("data-forgebook-status", "ready");
  await heightsMoved(page, 5);
  return drawsOf(page);
};

/**
 * Sends the shown story's frame the view the shell last sent it, with another theme.
 *
 * @param page - the page; its messages are counted (`countMessages`).
 * @param theme - the view's theme.
 */
const sendView = async (page: Page, theme: string): Promise<void> => {
  const last = await frameOf(page)
    .locator("html")
    .getAttribute(`${countAttribute("forgebook:view")}-last`);
  const shown: LiveView = JSON.parse(last ?? "");
  const view: LiveView = { ...shown, switches: { ...shown.switches, theme } };
  await page
    .locator("iframe.forgebook-frame-view")
    .first()
    .evaluate(
      (frame, message) => {
        if (!(frame instanceof HTMLIFrameElement)) throw new Error("Not a frame");
        frame.contentWindow?.postMessage(message, "*");
      },
      { type: "forgebook:view", view }
    );
};

test.describe("the view a frame is sent", () => {
  test("a story whose height moves is neither sent the view nor drawn again by its own reports", async ({
    page
  }) => {
    await countMessages(page);
    await page.goto(GROWING);
    const draws = await drawsOnceStarted(page);
    const views = await viewsOf(page);
    await heightsMoved(page, 30);
    expect(await viewsOf(page)).toBe(views);
    expect(await drawsOf(page)).toBe(draws);
  });

  test("on a component's page too, a moving height draws nothing again", async ({ page }) => {
    await countMessages(page);
    await page.goto("/?component=kit:foundations-growing-box");
    const draws = await drawsOnceStarted(page);
    await heightsMoved(page, 30);
    expect(await drawsOf(page)).toBe(draws);
  });

  test("a view equal to the one shown draws nothing, and another view draws the story once", async ({
    page
  }) => {
    await countMessages(page);
    await page.goto(GROWING);
    const draws = await drawsOnceStarted(page);
    await sendView(page, "dark");
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(() => drawsOf(page)).toBe(draws + 1);
    await sendView(page, "dark");
    await sendView(page, "light");
    await expect(frameOf(page).locator("html")).not.toHaveAttribute("data-theme", "dark");
    await expect.poll(() => drawsOf(page)).toBeGreaterThanOrEqual(draws + 2);
    // time for a draw of the repeated view to land, past the first moment the count reads right
    await heightsMoved(page, 5);
    expect(await drawsOf(page)).toBe(draws + 2);
  });

  test("a view that differs only in what the story fixes draws nothing", async ({ page }) => {
    await countMessages(page);
    await page.goto("/?story=kit:foundations-growing-box--fixed-dark");
    const draws = await drawsOnceStarted(page);
    await sendView(page, "light");
    await heightsMoved(page, 5);
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await drawsOf(page)).toBe(draws);
  });

  test("a change of the theme from the toolbar draws the story again", async ({ page }) => {
    await countMessages(page);
    await page.goto(GROWING);
    const draws = await drawsOnceStarted(page);
    await page.getByRole("radio", { name: "Dark" }).check({ force: true });
    await expect(frameOf(page).locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(() => drawsOf(page)).toBe(draws + 1);
  });
});
