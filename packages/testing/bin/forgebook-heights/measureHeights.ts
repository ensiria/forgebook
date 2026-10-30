/**
 * The logic of `forgebook-heights`: the widths it is asked for, the document it writes, and the run in a browser that
 * opens every story's frame and measures it at each width.
 *
 * @remarks
 * The frame page is the one the catalogue's stage opens (D-56, D-69), and its height is read as the frame reports it to
 * the shell (the body's own height), so a measured height is the one the stage would get. A story loads once at the
 * first width and is then resized through the others: a reload per width would multiply the run by them. `--serve`
 * serves a built catalogue with Vite's preview server, where a frame loads in one request per chunk instead of the
 * development server's hundreds of modules. `parseWidths` and `heightsDocument` are pure.
 *
 * @module
 */
import { type Browser, chromium, type Page } from "@playwright/test";
import { STATUS_ATTRIBUTE } from "forgebook/frame-status";
import type { StoryHeights } from "forgebook/story-heights";
import { STORY_IDS_ELEMENT } from "forgebook/story-ids-element";
import { frameAddressOf } from "forgebook/view-state";
import { preview } from "vite";

import type { HeightFailure } from "./measureHeights.types.ts";

/** The narrowest and widest widths a story is measured at, in CSS px: the stage's own range. */
const WIDTH_RANGE = { min: 240, max: 2560 } as const;

/** The viewport's height while measuring: a story taller than it still reports its whole height. */
const VIEWPORT_HEIGHT = 900;

/**
 * The widths a `--widths` text names: whole numbers of px within the stage's range, ascending, once each.
 *
 * @param text - the widths, separated by commas (`360,768,1440`).
 * @returns the widths, or the message that says what is wrong.
 */
export const parseWidths = (text: string): number[] | string => {
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  if (parts.length === 0) return "--widths needs at least one width";
  const wrong = parts.find((part) => {
    const width = Number(part);
    return !Number.isInteger(width) || width < WIDTH_RANGE.min || width > WIDTH_RANGE.max;
  });
  if (wrong !== undefined) {
    return `--widths takes whole numbers of px from ${WIDTH_RANGE.min} to ${WIDTH_RANGE.max}, not "${wrong}"`;
  }
  return [...new Set(parts.map(Number))].sort((left, right) => left - right);
};

/**
 * The document the shell reads: the stories measured, in the catalogue's order.
 *
 * @param widths - the widths measured at.
 * @param measured - each measured story's heights, at `widths`.
 */
export const heightsDocument = (
  widths: readonly number[],
  measured: ReadonlyMap<string, readonly number[]>
): StoryHeights => ({ widths: [...widths], heights: Object.fromEntries(measured) });

/** A catalogue to measure: its address, and how to let it go when the run is over. */
type Catalogue = {
  /** The catalogue's address, ending with `/`. */
  readonly address: string;
  /** Stops what was started to serve it; nothing for a catalogue already running. */
  readonly close: () => Promise<void>;
};

/**
 * The catalogue to measure: one already running, or a built one served for the run.
 *
 * @param catalogue - the running catalogue's address, used when there is nothing to serve.
 * @param serve - the folder of a built catalogue to serve; none to use the running one.
 */
export const openCatalogue = async (catalogue: string, serve: string | undefined): Promise<Catalogue> => {
  if (serve === undefined) {
    return { address: catalogue.endsWith("/") ? catalogue : `${catalogue}/`, close: async () => undefined };
  }
  const server = await preview({
    root: serve,
    configFile: false,
    logLevel: "silent",
    build: { outDir: "." },
    preview: { host: "127.0.0.1", port: 0, strictPort: false }
  });
  const [address] = server.resolvedUrls?.local ?? [];
  if (address === undefined) {
    await server.close();
    throw new Error(`Vite's preview server did not say where it serves ${serve}`);
  }
  return { address, close: () => server.close() };
};

/**
 * The catalogue's story ids, as its shell writes them into the page.
 *
 * @param browser - the browser.
 * @param address - the catalogue's address.
 * @param timeout - how long to wait for the shell, in ms.
 */
export const catalogueStoryIds = async (
  browser: Browser,
  address: string,
  timeout: number
): Promise<string[]> => {
  const page = await browser.newPage();
  try {
    await page.goto(address);
    const element = page.locator(`#${STORY_IDS_ELEMENT}`);
    await element.waitFor({ state: "attached", timeout });
    const ids: unknown = JSON.parse((await element.textContent()) ?? "[]");
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } finally {
    await page.close();
  }
};

/** The frame's height as it reports it to the shell: its body's own height, in whole px. */
const frameHeight = async (page: Page): Promise<number> =>
  // a text expression: the command runs on Node, where the page's own globals are not typed
  Number(await page.evaluate("Math.ceil(document.body.getBoundingClientRect().height)"));

/** Waits until the page laid out what a resize changed: two animation frames. */
const settled = async (page: Page): Promise<void> => {
  await page.evaluate(
    "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))))"
  );
};

/**
 * One story's heights at each width, or why it could not be measured.
 *
 * @param page - a page to measure in.
 * @param address - the catalogue's address.
 * @param storyId - the story's id.
 * @param widths - the widths, ascending.
 * @param timeout - how long to wait for the story, in ms.
 */
const measureStory = async (
  page: Page,
  address: string,
  storyId: string,
  widths: readonly number[],
  timeout: number
): Promise<readonly number[] | HeightFailure> => {
  const [first = WIDTH_RANGE.min] = widths;
  await page.setViewportSize({ width: first, height: VIEWPORT_HEIGHT });
  await page.goto(new URL(frameAddressOf("frame.html", storyId, ""), address).href);
  const status = await page
    .waitForFunction(
      `document.documentElement.getAttribute(${JSON.stringify(STATUS_ATTRIBUTE)})`,
      undefined,
      {
        timeout
      }
    )
    .then(async (handle) => String(await handle.jsonValue()))
    .catch(() => "timeout");
  if (status === "timeout") return { story: storyId, reason: `no answer in ${timeout} ms` };
  if (status !== "ready") {
    const error = await page.locator(".forgebook-frame-error__message").first().textContent();
    return { story: storyId, reason: error ?? "the story failed" };
  }
  const heights: number[] = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await settled(page);
    heights.push(await frameHeight(page));
  }
  return heights;
};

/** What a measuring run is told. */
export type MeasureRequest = {
  /** The catalogue's address. */
  readonly address: string;
  /** The widths, ascending. */
  readonly widths: readonly number[];
  /** How many stories load at once. */
  readonly concurrency: number;
  /** How long to wait for a story, in ms. */
  readonly timeout: number;
  /** Told the number of stories before the first is measured. */
  readonly onStart: (stories: number) => void;
  /** Told after each story, measured or not. */
  readonly onStory: (storyId: string) => void;
};

/** What a measuring run found. */
export type MeasureResult = {
  /** Every story's id, in the catalogue's order. */
  readonly storyIds: readonly string[];
  /** The measured stories' heights. */
  readonly measured: ReadonlyMap<string, readonly number[]>;
  /** The stories that could not be measured. */
  readonly failures: readonly HeightFailure[];
};

/**
 * Measures every story of a catalogue at each width.
 *
 * @param request - the catalogue, the widths, how many at once, and what to tell along the way.
 */
export const measureStories = async (request: MeasureRequest): Promise<MeasureResult> => {
  const browser = await chromium.launch();
  try {
    const storyIds = await catalogueStoryIds(browser, request.address, request.timeout);
    request.onStart(storyIds.length);
    const measured = new Map<string, readonly number[]>();
    const failures: HeightFailure[] = [];
    let next = 0;
    // each worker takes the next story until none is left, so a slow story never holds the others
    const worker = async (): Promise<void> => {
      const page = await browser.newPage();
      try {
        for (let index = next++; index < storyIds.length; index = next++) {
          const storyId = storyIds[index] ?? "";
          const result = await measureStory(page, request.address, storyId, request.widths, request.timeout);
          if ("reason" in result) failures.push(result);
          else measured.set(storyId, result);
          request.onStory(storyId);
        }
      } finally {
        await page.close();
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, request.concurrency) }, worker));
    // the catalogue's order, not the order the workers finished in
    const ordered = new Map(
      storyIds.flatMap((id): [string, readonly number[]][] => {
        const heights = measured.get(id);
        return heights === undefined ? [] : [[id, heights]];
      })
    );
    return { storyIds, measured: ordered, failures };
  } finally {
    await browser.close();
  }
};
