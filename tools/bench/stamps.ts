/**
 * When something was drawn, stamped by the page itself.
 *
 * @remarks
 * Waiting from outside would measure the waiter: Playwright's `waitFor` retries at 0, 20, 70, 170, 270 and 770 ms and
 * every 500 ms after that, so a time read when it returns lands on that grid. So the top page looks, once per animation
 * frame, at its own document and at the frames' documents, and notes the clock one frame after an element is fully
 * shown (laid out, and neither fading nor hidden through any ancestor, across the frame), by then painted. The harness only asks for the stamp afterwards, so how often it asks does not matter.
 *
 * It runs in the top page alone: an observer inside a frame can stay attached to the frame's first blank document, since
 * a browser reuses that window when the frame navigates and the script is not run again. Stamps belong to a document, so
 * a frame that reloads starts over and a stamp read after the page settled belongs to the document that stayed. Wall
 * clock on both sides, the one clock a browser's processes and Node share. It costs one frame of precision and very
 * little work, the same for every tool.
 *
 * @module
 */

/** What the page is told to watch for, besides the stories' own texts. */
export type StampWatch = {
  /** Texts stamped when the top page's body holds them. */
  readonly texts: readonly string[];
  /** Selectors stamped when they match something drawn. */
  readonly selectors: readonly string[];
};

/** The part of a page stamps are read through. */
export type StampedPage = {
  /** Runs an expression in the top page. */
  readonly evaluate: (expression: string) => Promise<unknown>;
};

/** How often the harness asks for a stamp, in milliseconds. */
const ASK_INTERVAL = 20;

/**
 * The script a top page runs: every text of the corpus's elements, and what `watch` names, stamped once per document.
 *
 * @param watch - the extra texts and selectors.
 */
export const stampScript = (watch: StampWatch): string => `(() => {
  if (window !== window.top) return;
  const watch = ${JSON.stringify(watch)};
  const byDocument = new WeakMap();
  let frame = 0;
  const stampsOf = (target) => {
    if (!byDocument.has(target)) byDocument.set(target, { seen: {}, times: {} });
    return byDocument.get(target);
  };
  const documents = () => {
    const found = [document];
    for (const element of document.querySelectorAll("iframe")) {
      const inner = element.contentDocument;
      if (inner !== null && inner.URL !== "about:blank") found.push(inner);
    }
    return found;
  };
  // up through the frame into the top document: a fade on any ancestor means the element cannot be read yet
  const isOpaque = (element) => {
    for (let each = element; each !== null; each = each.parentElement ?? each.ownerDocument.defaultView?.frameElement ?? null) {
      const style = each.ownerDocument.defaultView.getComputedStyle(each);
      if (style.opacity !== "1" || style.visibility !== "visible") return false;
    }
    return true;
  };
  const isDrawn = (element) => element.getClientRects().length > 0 && isOpaque(element);
  const look = (target) => {
    const { seen, times } = stampsOf(target);
    const see = (key) => {
      if (!(key in seen)) seen[key] = frame;
    };
    for (const element of target.querySelectorAll('[data-bench="label"],[data-bench="build"]')) {
      if (!(element.textContent in seen) && isDrawn(element)) see(element.textContent);
    }
    for (const selector of watch.selectors) {
      if (selector in seen) continue;
      const element = target.querySelector(selector);
      if (element !== null && isDrawn(element)) see(selector);
    }
    if (target === document && document.body !== null) {
      for (const text of watch.texts) {
        if (!(text in seen) && document.body.textContent.includes(text)) see(text);
      }
    }
    for (const [key, sighted] of Object.entries(seen)) {
      if (!(key in times) && frame > sighted) times[key] = Date.now();
    }
  };
  const tick = () => {
    frame += 1;
    for (const target of documents()) look(target);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  globalThis.__benchStamps = () => {
    const merged = {};
    for (const target of documents()) {
      for (const [key, time] of Object.entries(stampsOf(target).times)) {
        if (!(key in merged) || time < merged[key]) merged[key] = time;
      }
    }
    return merged;
  };
})();`;

/** Whether a value is stamps. */
const isStamps = (value: unknown): value is Readonly<Record<string, number>> =>
  typeof value === "object" && value !== null;

/**
 * The stamps of the documents a page shows now, the earliest of each key. A page being replaced has none.
 *
 * @param page - the page.
 */
export const pageStamps = async (page: StampedPage): Promise<Readonly<Record<string, number>>> => {
  const stamps = await page.evaluate("globalThis.__benchStamps?.()").catch((): unknown => undefined);
  return isStamps(stamps) ? stamps : {};
};

/**
 * Waits for every key to be stamped.
 *
 * @param page - the page.
 * @param keys - the texts or selectors.
 * @param deadline - the wall-clock time to give up at, in milliseconds.
 * @returns the time of each key, in the same order.
 * @throws at the deadline, naming what never showed.
 */
export const waitForStamps = async (
  page: StampedPage,
  keys: readonly string[],
  deadline: number
): Promise<number[]> => {
  for (;;) {
    const stamps = await pageStamps(page);
    const times = keys.flatMap((key) => {
      const time = stamps[key];
      return time === undefined ? [] : [time];
    });
    if (times.length === keys.length) return times;
    if (Date.now() > deadline) {
      throw new Error(`never drawn: ${keys.filter((key) => stamps[key] === undefined).join(", ")}`);
    }
    await new Promise((resolve) => setTimeout(resolve, ASK_INTERVAL));
  }
};
