/**
 * The window `forgebook dev --touch` opens: the catalogue in a Chromium of Playwright's, with Chromium's own touch
 * emulation, so the mouse makes real touch events (trusted, with the browser's own scrolling) where the catalogue's
 * Touch switch can only simulate them.
 *
 * @remarks
 * Loaded from the project by the command only when it runs, as the check is, so the core needs no browser. The
 * emulation is turned on through the browser's protocol (CDP) in every page of the window, popups included, and the
 * pages are marked (`forgebook/real-touch`) so the catalogue's simulated touch stays off there. Still a computer: no
 * virtual keyboard, no viewport shrinking under it, no iOS Safari.
 *
 * @module
 */
import { chromium, type Page } from "@playwright/test";
import { REAL_TOUCH_FLAG, type TouchWindowRequest } from "forgebook/real-touch";

/** How many fingers the emulation offers. */
const MAX_TOUCH_POINTS = 5;

/** The pages whose emulation is on: the first page is turned on before it loads, and the context then reports it. */
const emulated = new WeakSet<Page>();

/**
 * Turns Chromium's touch emulation on in a page: the mouse's presses become touches, as in DevTools' device mode.
 *
 * @param page - the page.
 */
const emulateTouch = async (page: Page): Promise<void> => {
  if (emulated.has(page)) return;
  emulated.add(page);
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: MAX_TOUCH_POINTS
  });
  await session.send("Emulation.setEmitTouchEventsForMouse", { enabled: true, configuration: "mobile" });
};

/**
 * Opens the catalogue in a touch window and waits until the person closes it.
 *
 * @param request - the catalogue's address.
 */
export const openTouchWindow = async (request: TouchWindowRequest): Promise<void> => {
  const browser = await chromium.launch({ headless: false });
  // the window's own size, not a fixed viewport: the person resizes it as they like
  const context = await browser.newContext({ viewport: null, hasTouch: true });
  await context.addInitScript((flag: string): void => {
    Object.defineProperty(window, flag, { value: true });
  }, REAL_TOUCH_FLAG);
  context.on("page", (page: Page): void => {
    void emulateTouch(page);
  });
  const page = await context.newPage();
  await emulateTouch(page);
  await page.goto(request.url);
  await new Promise<void>((done) => {
    browser.on("disconnected", (): void => done());
    // the last page closed closes the window
    context.on("close", (): void => done());
    page.on("close", (): void => {
      if (context.pages().length === 0) void browser.close();
    });
  });
};
