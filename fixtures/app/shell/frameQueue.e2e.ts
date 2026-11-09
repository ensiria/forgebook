/**
 * How many frames a component's page loads at once, on the fixture app: its demo counts among them; and which load
 * first after a fast scroll, on the HTML fixture's long page.
 *
 * @remarks
 * In development a frame of a library served as source asks for thousands of modules, and the browser refuses
 * requests past its limit for a page (`ERR_INSUFFICIENT_RESOURCES`): one frame more than the queue allows is enough for
 * stories never to draw. With so few places, a place given to a story the reader is not looking at makes the ones in
 * view wait.
 *
 * @module
 */
import { expect, type Page, test } from "@playwright/test";

import { catalogueUrl } from "./ports";

declare global {
  interface Window {
    /** When each story's frame was put on the page, by the story's name, read in the shell. */
    forgebookStarted?: Map<string, number>;
    /** The stories whose frame drew, by name, read in the shell. */
    forgebookDrawn?: Set<string>;
  }
}

/** The fixture's Select: its demo and eight examples. */
const SELECT = "/?component=kit:inputs-selection-select";

/** The HTML fixture's long page: 120 stories, each as tall as the box that waits for it. */
const LONG_PAGE = `${catalogueUrl("html")}?component=html:layout-long-page`;

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

/**
 * Holds every frame's page `FRAME_DELAY` before it is served, so a frame takes long enough to load that the order the
 * queue starts them in shows.
 *
 * @param page - the test's page.
 */
const holdFrames = async (page: Page): Promise<void> => {
  await page.route(/\/frame\.html\?/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, FRAME_DELAY));
    await route.continue();
  });
};

test.describe("the frames of a long page after a fast scroll", () => {
  test("load the stories in view before any other story still waiting", async ({ page }) => {
    // read in the shell at every animation frame: when each story's frame was put on the page, and when it drew
    await page.addInitScript(() => {
      if (window !== window.top) return;
      const started = new Map<string, number>();
      const drawn = new Set<string>();
      window.forgebookStarted = started;
      window.forgebookDrawn = drawn;
      const readExample = (example: Element): void => {
        const name = example.getAttribute("aria-label") ?? "";
        if (!started.has(name) && example.querySelector("iframe") !== null)
          started.set(name, performance.now());
        if (example.querySelector(".forgebook-frame-box:not([data-loading]) iframe") !== null)
          drawn.add(name);
      };
      const read = (): void => {
        for (const example of document.querySelectorAll(".forgebook-example")) readExample(example);
        requestAnimationFrame(read);
      };
      requestAnimationFrame(read);
    });
    await holdFrames(page);
    await page.goto(LONG_PAGE);
    await expect(page.locator(".forgebook-frame-box:not([data-loading])").first()).toBeVisible({
      timeout: 30_000
    });
    // to the end in a few hundred milliseconds, a step at every animation frame, as a fling does; then where it
    // stopped: the moment, and the stories in view
    const stop = await page.evaluate(
      () =>
        new Promise<{ readonly at: number; readonly inView: readonly string[] }>((resolve) => {
          const scroller = document.querySelector(".forgebook-scroll");
          if (scroller === null) throw new Error("the page has no scrolling element");
          const stopped = (): void => {
            const view = scroller.getBoundingClientRect();
            const inView = [...document.querySelectorAll(".forgebook-example")]
              .filter((example) => {
                const box = example.getBoundingClientRect();
                return box.bottom > view.top && box.top < view.bottom;
              })
              .map((example) => example.getAttribute("aria-label") ?? "");
            resolve({ at: performance.now(), inView });
          };
          const step = (): void => {
            scroller.scrollTop += 1500;
            if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) stopped();
            else requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        })
    );
    expect(stop.inView.length).toBeGreaterThan(MOST_LOADING);
    await expect
      .poll(
        () =>
          page.evaluate(
            (names) => names.filter((name) => window.forgebookDrawn?.has(name) !== true),
            stop.inView
          ),
        { timeout: 30_000 }
      )
      .toEqual([]);
    // no story out of view took a place before the last one in view had its own: frames already loading when the
    // scroll stopped may finish, but nothing new starts ahead of the view
    const startedAhead = await page.evaluate(({ at, inView }) => {
      const started = window.forgebookStarted ?? new Map<string, number>();
      const lastInView = Math.max(...inView.map((name) => started.get(name) ?? 0));
      return [...started]
        .filter(([name, time]) => time > at && time < lastInView && !inView.includes(name))
        .map(([name]) => name);
    }, stop);
    expect(startedAhead).toEqual([]);
  });
});
