/**
 * How many frames a component's page loads at once, on the fixture app: its demo counts among them.
 *
 * @remarks
 * In development a frame of a library served as source asks for thousands of modules, and the browser refuses
 * requests past its limit for a page (`ERR_INSUFFICIENT_RESOURCES`): one frame more than the queue allows is enough for
 * stories never to draw.
 *
 * @module
 */
import { expect, test } from "@playwright/test";

/** The fixture's Select: its demo and eight examples. */
const SELECT = "/?component=kit:inputs-selection-select";

/** The most frames a page loads at once (`useFrameQueue`). */
const MOST_LOADING = 2;

/**
 * How long each frame's page is held before it is served: long enough that frames mounted together load together, so
 * the most loading at once is what the page allows and not what the server's speed lets overlap.
 */
const FRAME_DELAY = 400;

test.describe("the frames of a component's page", () => {
  test("loads the demo and the examples a few at a time, the demo among them", async ({ page }) => {
    // read in the shell at every animation frame from the first: the most boxes whose frame was loading at once, and
    // how many frames there were when the demo's came
    await page.addInitScript(() => {
      if (window !== window.top) return;
      let most = 0;
      const count = (): void => {
        most = Math.max(most, document.querySelectorAll(".forgebook-frame-box[data-loading]").length);
        Reflect.set(window, "forgebookMostLoading", most);
        if (
          Reflect.get(window, "forgebookFramesWithDemo") === undefined &&
          document.querySelector("[data-demo] iframe") !== null
        ) {
          Reflect.set(window, "forgebookFramesWithDemo", document.querySelectorAll("iframe").length);
        }
        requestAnimationFrame(count);
      };
      requestAnimationFrame(count);
    });
    let held = 0;
    await page.route(/\/frame\.html\?/, async (route) => {
      held += 1;
      await new Promise((resolve) => setTimeout(resolve, FRAME_DELAY));
      await route.continue();
    });
    // tall enough for the demo and every example to be near, so only the queue keeps them waiting
    await page.setViewportSize({ width: 1280, height: 4000 });
    await page.goto(SELECT);
    const frames = page.locator("iframe.forgebook-frame-view");
    await expect(frames).toHaveCount(9, { timeout: 30_000 });
    await expect(page.locator(".forgebook-frame-box[data-loading]")).toHaveCount(0, { timeout: 30_000 });
    // every frame was held, on the frames' own origin too
    expect(held).toBe(9);
    expect(await page.evaluate(() => Reflect.get(window, "forgebookMostLoading"))).toBe(MOST_LOADING);
    // the demo, at the top, among the first to load
    expect(await page.evaluate(() => Reflect.get(window, "forgebookFramesWithDemo"))).toBeLessThanOrEqual(
      MOST_LOADING
    );
  });
});
