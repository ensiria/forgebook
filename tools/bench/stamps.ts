/**
 * When something was drawn, stamped by the page itself.
 *
 * @remarks
 * Waiting from outside would measure the waiter: Playwright's `waitFor` retries at 0, 20, 70, 170, 270 and 770 ms and
 * every 500 ms after that, so a time read when it returns lands on that grid. So the top page looks, once per animation
 * frame, at its own document and at the frames' documents, and notes the clock one frame after an element is fully
 * shown (laid out, and neither fading nor hidden through any ancestor, across the frame), by then painted. The harness
 * only asks for the stamp afterwards, so how often it asks does not matter.
 *
 * It looks from the top page: an observer inside a frame can stay attached to the frame's first blank document, since a
 * browser reuses that window when the frame navigates on its origin and the script is not run again. A frame on an
 * origin of its own (Forgebook's, in development) cannot be read from the top page; it gets a new window when it
 * navigates, so the script runs in its document and applies the same rule there: a key sighted at one animation frame
 * is stamped at the next, and posted with its time. The top page keeps that time when the frame's element was shown all
 * along, and stamps the key by its own rule when the frame was still being shown. Stamps belong to a document, so a
 * frame that reloads starts over and a stamp read after the page settled belongs to the document that stayed. Wall
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
  /** Texts stamped when a frame's body holds them: a real story, whose elements carry no mark of ours. */
  readonly frameTexts?: readonly string[];
  /** A regular expression's source: each match in a frame's body is stamped, the text an edit of a real file writes. */
  readonly frameMark?: string;
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
  const watch = ${JSON.stringify(watch)};
  // whether this document can read the top page's: a frame on an origin of its own cannot, nor be read from there
  const isReadByTop = (() => {
    try {
      return window.top.document !== undefined;
    } catch {
      return false;
    }
  })();
  // up through the document, and on into the top page's while it can be read: a fade on any ancestor means the element
  // cannot be read yet
  const isOpaque = (element) => {
    for (let each = element; each !== null; each = each.parentElement ?? each.ownerDocument.defaultView?.frameElement ?? null) {
      const style = each.ownerDocument.defaultView.getComputedStyle(each);
      if (style.opacity !== "1" || style.visibility !== "visible") return false;
    }
    return true;
  };
  const isDrawn = (element) => element.getClientRects().length > 0 && isOpaque(element);
  // the keys a document shows now, besides those already known: the top page's texts, or a frame's
  const shownKeys = (target, isFrame, isKnown) => {
    const keys = [];
    for (const element of target.querySelectorAll('[data-bench="label"],[data-bench="build"]')) {
      if (!isKnown(element.textContent) && isDrawn(element)) keys.push(element.textContent);
    }
    for (const selector of watch.selectors) {
      if (isKnown(selector)) continue;
      const element = target.querySelector(selector);
      if (element !== null && isDrawn(element)) keys.push(selector);
    }
    const text = target.body === null ? "" : target.body.textContent;
    for (const each of isFrame ? watch.frameTexts ?? [] : watch.texts) if (text.includes(each)) keys.push(each);
    if (isFrame && watch.frameMark !== undefined) keys.push(...(text.match(new RegExp(watch.frameMark, "g")) ?? []));
    return keys;
  };
  if (window !== window.top) {
    // a frame the top page reads itself does nothing; one on another origin tells the top page what it shows
    if (isReadByTop) return;
    // the same rule as the top page's, run in the frame: a key sighted at one animation frame is stamped at the next,
    // and the stamp is posted with its time
    const id = Math.random().toString(36).slice(2);
    const sighted = new Map();
    const stamped = new Set();
    let frame = 0;
    const tell = () => {
      frame += 1;
      const keys = [];
      for (const [key, at] of sighted) {
        if (!stamped.has(key) && frame > at) {
          stamped.add(key);
          keys.push(key);
        }
      }
      if (keys.length > 0) window.top.postMessage({ benchSeen: { id, keys, time: Date.now() } }, "*");
      for (const key of shownKeys(document, true, (each) => sighted.has(each))) {
        if (!sighted.has(key)) sighted.set(key, frame);
      }
      requestAnimationFrame(tell);
    };
    requestAnimationFrame(tell);
    return;
  }
  const byDocument = new Map();
  let frame = 0;
  const stampsOf = (target) => {
    if (!byDocument.has(target)) byDocument.set(target, { seen: {}, times: {}, told: [] });
    return byDocument.get(target);
  };
  // what a frame on another origin told, by the document it showed last: a frame that reloads starts over
  const toldBy = new WeakMap();
  // whether each frame's element was shown at the last animation frame
  const shownBefore = new WeakMap();
  window.addEventListener("message", (event) => {
    const told = event.data?.benchSeen;
    if (told === undefined || event.source === null) return;
    toldBy.set(event.source, told.id);
    stampsOf(told.id).told.push(...told.keys.map((key) => ({ key, time: told.time })));
  });
  // the top page's document, each frame's it can read, and each other frame's by what it told
  const documents = (isTick = false) => {
    const found = [document];
    for (const element of document.querySelectorAll("iframe")) {
      const inner = element.contentDocument;
      if (inner !== null && inner.URL !== "about:blank") found.push(inner);
      const id = inner === null && element.contentWindow !== null ? toldBy.get(element.contentWindow) : undefined;
      // a frame's element counts once the frame itself is shown: a fade on the frame hides what it holds
      if (id !== undefined) {
        const isShown = isDrawn(element);
        found.push({ id, isShown, wasShown: shownBefore.get(element) === true });
        if (isTick) shownBefore.set(element, isShown);
      }
    }
    return found;
  };
  const look = (target) => {
    const isTold = "id" in target;
    const { seen, times, told } = stampsOf(isTold ? target.id : target);
    const see = (key) => {
      if (!(key in seen)) seen[key] = frame;
    };
    if (!isTold) for (const key of shownKeys(target, target !== document, (key) => key in seen)) see(key);
    // a frame's stamp holds while its element was shown: one still fading in is stamped by the top page's rule instead
    if (isTold) {
      for (const { key, time } of told) {
        if (key in times || key in seen) continue;
        if (target.isShown && target.wasShown) times[key] = time;
        else if (target.isShown) see(key);
      }
    }
    for (const [key, sighted] of Object.entries(seen)) {
      if (!(key in times) && frame > sighted) times[key] = Date.now();
    }
  };
  const tick = () => {
    frame += 1;
    for (const target of documents(true)) look(target);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  globalThis.__benchStamps = () => {
    const merged = {};
    for (const target of documents()) {
      for (const [key, time] of Object.entries(stampsOf("id" in target ? target.id : target).times)) {
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
