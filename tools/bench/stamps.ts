/**
 * When something was drawn, stamped by the page itself.
 *
 * @remarks
 * Waiting from outside would measure the waiter: Playwright's `waitFor` retries at 0, 20, 70, 170, 270 and 770 ms and
 * every 500 ms after that, so a time read when it returns lands on that grid. So the page looks, once per animation
 * frame, at its own document and at the documents of its frames, and notes the clock one frame after an element is
 * fully shown (laid out, and neither fading nor hidden through any ancestor, across the frame), by then painted. The
 * harness only asks for the stamps afterwards, so how often it asks does not matter.
 *
 * The script runs in the top page and in every frame on an origin of its own (Forgebook's stories, by default), whose
 * document the page above cannot read. A frame its parent can read is watched from above instead: an observer inside it
 * can stay attached to the frame's first blank document, since a browser reuses that window when the frame navigates on
 * the same origin and the script is not run again. A frame on its own origin gets a new window, so its script does run.
 * An ancestor's fade cannot be seen from inside such a frame, so the document above stamps when the frame's element was
 * shown, and a time read inside the frame counts from then at the earliest.
 *
 * Stamps belong to a document, so a frame that reloads starts over and a stamp read after the page settled belongs to
 * the document that stayed. Wall clock on every side, the one clock a browser's processes and Node share. It costs one
 * frame of precision and very little work, the same for every tool.
 *
 * @module
 */
import type { Frame, Page } from "@playwright/test";

import { withDeadline } from "./deadline.ts";

/** What the page is told to watch for, besides the stories' own texts. */
export type StampWatch = {
  /** Texts stamped when the top page's body holds them. */
  readonly texts: readonly string[];
  /** Selectors stamped when they match something drawn, in whichever document. */
  readonly selectors: readonly string[];
  /** Texts stamped when a frame draws them: a real story, whose elements carry no mark of ours. */
  readonly frameTexts?: readonly string[];
  /** A regular expression's source: each match a frame draws is stamped, the text an edit of a real file writes. */
  readonly frameMark?: string;
};

/** A document of a page, as the harness reads it. */
export type StampedFrame = {
  /** Runs an expression in the frame's document. */
  readonly evaluate: (expression: string) => Promise<unknown>;
  /** When the frame's element was shown, as the document watching it stamped it; none for the top page. */
  readonly shown: () => Promise<unknown>;
  /** The frame it is in; none for the top page. */
  readonly parent: StampedFrame | undefined;
};

/** The part of a page stamps are read through. */
export type StampedPage = {
  /** Its documents now, the top page first. */
  readonly frames: () => readonly StampedFrame[];
};

/** What one frame told, for `combineStamps`. */
export type FrameReading = {
  /** Its own stamps; none when no script runs in it, since the document above watches it. */
  readonly stamps: Readonly<Record<string, number>> | undefined;
  /** When its element was shown; none for the top page, or a frame not shown yet. */
  readonly shown: number | undefined;
  /** The index of the frame it is in; none for the top page. */
  readonly parent: number | undefined;
};

/** How often the harness asks for a stamp, in milliseconds. */
const ASK_INTERVAL = 20;

/**
 * How long one reading of a frame may take, in milliseconds: a frame whose script is stuck never answers, and the
 * reading is then taken as none, so the wait reaches its own deadline and fails the sample.
 */
const ASK_TIMEOUT = 10_000;

/** The global a stamping document reads its stamps through. */
const STAMPS_GLOBAL = "benchStamps";

/** The global a stamping document answers when a frame's element was shown through. */
const SHOWN_GLOBAL = "benchFrameShown";

/**
 * The script every document runs: every text of the corpus's elements, and what `watch` names, stamped once per
 * document, and the frames' elements stamped when shown.
 *
 * @param watch - the extra texts and selectors.
 */
export const stampScript = (watch: StampWatch): string => `(() => {
  // a frame its parent can read is watched from there
  if (window !== window.top && window.frameElement !== null) return;
  const watch = ${JSON.stringify(watch)};
  const byDocument = new WeakMap();
  const shown = new WeakMap();
  let frame = 0;
  const stampsOf = (target) => {
    if (!byDocument.has(target)) byDocument.set(target, { seen: {}, times: {} });
    return byDocument.get(target);
  };
  // this document and the frames it can read, down any depth; a frame on another origin stamps itself
  const documents = () => {
    const found = [document];
    for (let index = 0; index < found.length; index += 1) {
      for (const element of found[index].querySelectorAll("iframe")) {
        const inner = element.contentDocument;
        if (inner !== null && inner.URL !== "about:blank") found.push(inner);
      }
    }
    return found;
  };
  // up through the frames this document can read: a fade on any ancestor means the element cannot be read yet
  const isOpaque = (element) => {
    for (let each = element; each !== null; each = each.parentElement ?? each.ownerDocument.defaultView?.frameElement ?? null) {
      const style = each.ownerDocument.defaultView.getComputedStyle(each);
      if (style.opacity !== "1" || style.visibility !== "visible") return false;
    }
    return true;
  };
  const isDrawn = (element) => element.getClientRects().length > 0 && isOpaque(element);
  const frameMark = watch.frameMark === undefined ? undefined : new RegExp(watch.frameMark, "g");
  const drawnText = (target) => {
    const walker = target.createTreeWalker(target.body, NodeFilter.SHOW_TEXT);
    const parts = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (parent !== null && node.data.trim() !== "" && isDrawn(parent)) parts.push(node.data);
    }
    return parts.join(" ");
  };
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
    if (target === document && window === window.top && document.body !== null) {
      for (const text of watch.texts) {
        if (!(text in seen) && document.body.textContent.includes(text)) see(text);
      }
    }
    // a story's document, read from above or stamping itself on an origin of its own
    if (!(target === document && window === window.top) && target.body !== null) {
      const raw = target.body.textContent;
      const texts = (watch.frameTexts ?? []).filter((each) => !(each in seen) && raw.includes(each));
      const marks = frameMark === undefined ? [] : (raw.match(frameMark) ?? []).filter((each) => !(each in seen));
      // only then the text that is drawn, the costly read: hidden or fading text, or a script's, is not drawn yet
      if (texts.length > 0 || marks.length > 0) {
        const shownText = drawnText(target);
        for (const each of [...texts, ...marks]) {
          if (shownText.includes(each)) see(each);
        }
      }
    }
    for (const [key, sighted] of Object.entries(seen)) {
      if (!(key in times) && frame > sighted) times[key] = Date.now();
    }
    for (const element of target.querySelectorAll("iframe")) {
      const state = shown.get(element);
      if (state === undefined) {
        if (isDrawn(element)) shown.set(element, { sighted: frame, time: undefined });
      } else if (state.time === undefined && frame > state.sighted) {
        state.time = Date.now();
      }
    }
  };
  const tick = () => {
    frame += 1;
    for (const target of documents()) look(target);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  globalThis.${STAMPS_GLOBAL} = () => {
    const merged = {};
    for (const target of documents()) {
      for (const [key, time] of Object.entries(stampsOf(target).times)) {
        if (!(key in merged) || time < merged[key]) merged[key] = time;
      }
    }
    return merged;
  };
  globalThis.${SHOWN_GLOBAL} = (element) => shown.get(element)?.time;
})();`;

/** A window of the page, as the lookup of a frame's element reads it: Node has no DOM types. */
type PageWindow = {
  /** The element of the frame this window is in, when its parent can read it. */
  readonly frameElement: PageElement | null;
  /** The stamp script's lookup, in a window it runs in; `SHOWN_GLOBAL` names it. */
  readonly benchFrameShown?: (element: PageElement) => unknown;
};

/** An element of the page, as the lookup of a frame's element reads it. */
type PageElement = {
  /** Its document. */
  readonly ownerDocument: { readonly defaultView: PageWindow | null };
};

/**
 * When a frame's element was shown, run in the page on the element: asked of the nearest window up that stamps, since
 * a frame the script skipped is watched by its parent.
 *
 * @param element - the frame's element.
 */
const shownInPage = (element: PageElement): unknown => {
  for (
    let view = element.ownerDocument.defaultView;
    view !== null;
    view = view.frameElement?.ownerDocument.defaultView ?? null
  ) {
    if (view.benchFrameShown !== undefined) return view.benchFrameShown(element);
  }
  return undefined;
};

/** Whether a value is stamps. */
const isStamps = (value: unknown): value is Readonly<Record<string, number>> =>
  typeof value === "object" && value !== null;

/**
 * Every key's earliest time across the frames, a frame's own stamps counted from when its element was shown, and
 * through every frame above that stamps itself: drawn in a hidden frame is not drawn.
 *
 * @param readings - each frame's, the top page first; `parent` indexes this list.
 */
export const combineStamps = (readings: readonly FrameReading[]): Readonly<Record<string, number>> => {
  // the nearest frame up that stamps itself, the one whose script watched this frame's element
  const watcherOf = (index: number): number | undefined => {
    let parent = readings[index]?.parent;
    while (parent !== undefined && readings[parent]?.stamps === undefined) parent = readings[parent]?.parent;
    return parent;
  };
  // the time from which a frame's own stamps count; none while it or a frame above is not shown
  const shownFrom = (index: number): number | undefined => {
    const reading = readings[index];
    if (reading === undefined) return undefined;
    if (reading.parent === undefined) return 0;
    const watcher = watcherOf(index);
    const above = watcher === undefined ? undefined : shownFrom(watcher);
    return reading.shown === undefined || above === undefined ? undefined : Math.max(reading.shown, above);
  };
  const merged: Record<string, number> = {};
  for (const [index, reading] of readings.entries()) {
    const from = shownFrom(index);
    if (reading.stamps === undefined || from === undefined) continue;
    for (const [key, stamp] of Object.entries(reading.stamps)) {
      const time = Math.max(stamp, from);
      const earlier = merged[key];
      if (earlier === undefined || time < earlier) merged[key] = time;
    }
  }
  return merged;
};

/** A number, or none for anything else. */
const numberOf = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);

/**
 * The stamps of the documents a page shows now, the earliest of each key. A document being replaced has none.
 *
 * @param page - the page.
 */
export const pageStamps = async (page: StampedPage): Promise<Readonly<Record<string, number>>> => {
  const frames = page.frames();
  const readings = await Promise.all(
    frames.map(async (frame): Promise<FrameReading> => {
      const value = await frame.evaluate(`globalThis.${STAMPS_GLOBAL}?.()`).catch((): unknown => undefined);
      const stamps = isStamps(value) ? value : undefined;
      const isInner = frame.parent !== undefined;
      const shown =
        isInner && stamps !== undefined
          ? numberOf(await frame.shown().catch((): unknown => undefined))
          : undefined;
      if (frame.parent === undefined) return { stamps, shown, parent: undefined };
      const parent = frames.indexOf(frame.parent);
      // a frame whose parent just left the page is leaving too: nothing of it counts
      return parent === -1
        ? { stamps: undefined, shown: undefined, parent: undefined }
        : { stamps, shown, parent };
    })
  );
  return combineStamps(readings);
};

/**
 * A Playwright page, read as a `StampedPage`.
 *
 * @param page - the page.
 */
export const stampedPage = (page: Page): StampedPage => {
  const known = new WeakMap<Frame, StampedFrame>();
  const stampedFrame = (frame: Frame): StampedFrame => {
    const existing = known.get(frame);
    if (existing !== undefined) return existing;
    const parentFrame = frame.parentFrame();
    const created: StampedFrame = {
      evaluate: (expression) => withDeadline(frame.evaluate(expression), ASK_TIMEOUT, "a frame's reading"),
      shown: async () => {
        const element = await withDeadline(frame.frameElement(), ASK_TIMEOUT, "a frame's element");
        try {
          return await withDeadline(
            element.evaluate(shownInPage),
            ASK_TIMEOUT,
            "a frame's element's reading"
          );
        } finally {
          await element.dispose().catch(() => undefined);
        }
      },
      parent: parentFrame === null ? undefined : stampedFrame(parentFrame)
    };
    known.set(frame, created);
    return created;
  };
  return { frames: () => page.frames().map(stampedFrame) };
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
