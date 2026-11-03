/**
 * Stories compared with their baselines, as `forgebook diff` asks: each picture taken again and read against the one
 * `forgebook shot --update` stored.
 *
 * @remarks
 * The pixels are compared in the browser the pictures come from, on a canvas: it is already there, and decoding PNG in
 * Node would be a dependency for one comparison. A baseline only compares with pictures of the same rendering, so one
 * taken on another system reads as changed or resized: take them where they are compared. A pixel counts as changed when a channel moves by more than `TOLERANCE`, which holds off rounding and no more; the answer
 * gives the region and the percentage, and the decision about what matters stays with whoever reads it.
 *
 * @module
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import { chromium, type Page } from "@playwright/test";
import type { StoryDiff, StoryDiffReport, StoryDiffRequest, StoryShot } from "forgebook/story-check";

import { shotName, shotStories } from "./shotStories.ts";

/** How far a colour channel may move and stay the same, out of 255. */
export const TOLERANCE = 2;

/** The colour that marks a changed pixel. */
const MARK = [255, 0, 80, 255];

/** How many bytes go to `String.fromCharCode` at once: a whole picture overflows the call's arguments. */
const CHUNK = 0x8000;

/** How many rows cross to the browser at once. */
const BAND_ROWS = 2000;

/** What comparing two pictures says. */
export type PictureDifference = {
  /** Their sizes differ, so no pixel can be compared. */
  readonly isSizeChanged: boolean;
  /** The pixels that changed. */
  readonly changedPixels: number;
  /** Their share of the picture, 0 to 100. */
  readonly percent: number;
  /** The smallest box that holds them; none when nothing changed. */
  readonly region: { x: number; y: number; width: number; height: number } | undefined;
  /** The picture with what changed marked, a PNG as a data URL; none when nothing can be marked. */
  readonly marked: string | undefined;
};

/** A PNG's bytes as a data URL. */
const dataUrl = (file: string): string => `data:image/png;base64,${readFileSync(file).toString("base64")}`;

/** A picture's pixels, four bytes each: red, green, blue, alpha. */
export type Pixels = {
  /** Its width, in pixels. */
  readonly width: number;
  /** Its height, in pixels. */
  readonly height: number;
  /** Its bytes. */
  readonly bytes: Uint8Array;
};

/** Whether a pixel moved by more than the tolerance in any channel. */
const hasMoved = (first: Uint8Array, second: Uint8Array, index: number, tolerance: number): boolean => {
  for (let channel = 0; channel < 4; channel += 1) {
    if (Math.abs((first[index + channel] ?? 0) - (second[index + channel] ?? 0)) > tolerance) return true;
  }
  return false;
};

/**
 * Compares two pictures' pixels.
 *
 * @param before - the stored picture.
 * @param after - the new one.
 * @param tolerance - how far a channel may move.
 * @returns what changed, and the new picture's pixels with those marked.
 */
export const comparePixels = (
  before: Pixels,
  after: Pixels,
  tolerance: number = TOLERANCE
): Omit<PictureDifference, "marked"> & { readonly marks: Uint8Array } => {
  const { width, height } = after;
  const marks = Uint8Array.from(after.bytes);
  if (before.width !== width || before.height !== height) {
    return { isSizeChanged: true, changedPixels: 0, percent: 100, region: undefined, marks };
  }
  let changedPixels = 0;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (hasMoved(before.bytes, after.bytes, index, tolerance)) {
        changedPixels += 1;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
        marks.set(MARK, index);
      }
    }
  }
  const region =
    changedPixels === 0 ? undefined : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  return {
    isSizeChanged: false,
    changedPixels,
    percent: (changedPixels / (width * height)) * 100,
    region,
    marks
  };
};

/** A PNG's pixels, decoded by the browser and carried over in bands: one message cannot hold a tall picture. */
const pixelsOf = async (page: Page, source: string): Promise<Pixels> => {
  const { width, height } = await page.evaluate(async (url) => {
    const bitmap = await createImageBitmap(await (await fetch(url)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext("2d", { willReadFrequently: true })?.drawImage(bitmap, 0, 0);
    Object.assign(globalThis, { forgebookCanvas: canvas });
    return { width: bitmap.width, height: bitmap.height };
  }, source);
  const bands: Buffer[] = [];
  for (let top = 0; top < height; top += BAND_ROWS) {
    const rows = Math.min(BAND_ROWS, height - top);
    const band = await page.evaluate(
      ({ y, size, across, chunk }) => {
        const canvas = Reflect.get(globalThis, "forgebookCanvas");
        if (!(canvas instanceof OffscreenCanvas)) throw new Error("No picture to read");
        const pixels = canvas.getContext("2d")?.getImageData(0, y, across, size).data;
        if (pixels === undefined) throw new Error("No canvas to compare on");
        let text = "";
        for (let start = 0; start < pixels.length; start += chunk) {
          text += String.fromCharCode(...pixels.subarray(start, start + chunk));
        }
        return btoa(text);
      },
      { y: top, size: rows, across: width, chunk: CHUNK }
    );
    bands.push(Buffer.from(band, "base64"));
  }
  return { width, height, bytes: Buffer.concat(bands) };
};

/** Pixels as a PNG data URL, encoded by the browser, carried over in bands as they were read. */
const pngOf = async (page: Page, pixels: Pixels): Promise<string> => {
  const { width, height, bytes } = pixels;
  await page.evaluate(
    ({ across, down }) => {
      Object.assign(globalThis, { forgebookCanvas: new OffscreenCanvas(across, down) });
    },
    { across: width, down: height }
  );
  for (let top = 0; top < height; top += BAND_ROWS) {
    const rows = Math.min(BAND_ROWS, height - top);
    const band = bytes.subarray(top * width * 4, (top + rows) * width * 4);
    await page.evaluate(
      ({ y, across, size, data }) => {
        const canvas = Reflect.get(globalThis, "forgebookCanvas");
        if (!(canvas instanceof OffscreenCanvas)) throw new Error("No picture to write");
        const part = Uint8ClampedArray.from(atob(data), (letter) => letter.charCodeAt(0));
        canvas.getContext("2d")?.putImageData(new ImageData(part, across, size), 0, y);
      },
      { y: top, across: width, size: rows, data: Buffer.from(band).toString("base64") }
    );
  }
  return page.evaluate(async (chunk) => {
    const canvas = Reflect.get(globalThis, "forgebookCanvas");
    if (!(canvas instanceof OffscreenCanvas)) throw new Error("No picture to write");
    const png = new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
    let text = "";
    for (let start = 0; start < png.length; start += chunk) {
      text += String.fromCharCode(...png.subarray(start, start + chunk));
    }
    return `data:image/png;base64,${btoa(text)}`;
  }, CHUNK);
};

/**
 * Compares two pictures, with the browser reading and writing the PNGs.
 *
 * @param page - any page.
 * @param baseline - the stored picture, as a data URL.
 * @param current - the new one, as a data URL.
 */
export const comparePictures = async (
  page: Page,
  baseline: string,
  current: string
): Promise<PictureDifference> => {
  const after = await pixelsOf(page, current);
  const { marks, ...difference } = comparePixels(await pixelsOf(page, baseline), after);
  const marked = difference.changedPixels === 0 ? undefined : await pngOf(page, { ...after, bytes: marks });
  return { ...difference, marked };
};

/**
 * The baselines of a component with no story left: what would otherwise pass without a word when a story is removed.
 *
 * @param files - the baselines folder's PNG files.
 * @param component - the component's id.
 * @param stories - its stories' ids.
 * @returns the files.
 */
export const removedBaselines = (
  files: readonly string[],
  component: string,
  stories: readonly string[]
): readonly string[] => {
  const prefixOf = (id: string): string =>
    `${shotName({ story: { id }, name: "" }).replace(/default\.png$/, "")}`;
  const owned = prefixOf(component);
  const kept = stories.map(prefixOf);
  return files.filter(
    (file) =>
      file.startsWith(owned) && !file.endsWith(".diff.png") && !kept.some((prefix) => file.startsWith(prefix))
  );
};

/**
 * The stored baseline a picture compares with: the one with its name, else the one named by the story's former id
 * (`StoryCheckStory.formerId`), so the baselines stored before the ids followed Storybook's still count.
 *
 * @param files - the baselines folder's files.
 * @param name - the picture's name.
 * @param formerName - the name the picture had under the story's former id; none when the id did not change.
 * @returns the baseline's name; the picture's own when neither is stored (a new baseline).
 */
export const storedBaseline = (
  files: readonly string[],
  name: string,
  formerName: string | undefined
): string =>
  !files.includes(name) && formerName !== undefined && files.includes(formerName) ? formerName : name;

/** One picture's result. Read before anything is written: the pictures must not touch what they are compared with. */
const diffOf = async (
  page: Page,
  shot: StoryShot,
  folders: { readonly baselines: string; readonly out: string; readonly baselineName: string }
): Promise<StoryDiff> => {
  const name = basename(shot.file);
  const baseline = join(folders.baselines, folders.baselineName);
  const current = join(folders.out, name);
  copyFileSync(shot.file, current);
  const base = { storyId: shot.storyId, view: shot.view, baseline, current };
  if (shot.status !== undefined) return { ...base, status: "broken", changedPixels: 0, percent: 100 };
  if (!existsSync(baseline)) return { ...base, status: "new", changedPixels: 0, percent: 0 };
  // most stories do not change, and equal files need no decoding
  if (readFileSync(baseline).equals(readFileSync(shot.file))) {
    return { ...base, status: "same", changedPixels: 0, percent: 0 };
  }
  const difference = await comparePictures(page, dataUrl(baseline), dataUrl(shot.file));
  if (difference.isSizeChanged) return { ...base, status: "resized", changedPixels: 0, percent: 100 };
  if (difference.changedPixels === 0) return { ...base, status: "same", changedPixels: 0, percent: 0 };
  const diff = join(folders.out, name.replace(/\.png$/, ".diff.png"));
  const [, data] = (difference.marked ?? "").split(",");
  writeFileSync(diff, Buffer.from(data ?? "", "base64"));
  return {
    ...base,
    status: "changed",
    changedPixels: difference.changedPixels,
    percent: difference.percent,
    ...(difference.region === undefined ? {} : { region: difference.region }),
    diff
  };
};

/**
 * Compares the stories a request names with their baselines.
 *
 * @param request - the stories, the views, the baselines' folder and where the pictures go.
 * @returns one result per story and view, and one per baseline left by a removed story.
 * @throws when the pictures would go in the baselines' folder, and overwrite what they prove.
 */
export const diffStories = async (request: StoryDiffRequest): Promise<StoryDiffReport> => {
  if (resolve(request.outDir) === resolve(request.baselines)) {
    throw new Error("The pictures cannot go in the baselines' folder: give --out another one");
  }
  const taken = mkdtempSync(join(tmpdir(), "forgebook-diff-"));
  mkdirSync(request.outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const { shots } = await shotStories({ ...request, outDir: taken });
    const page = await browser.newPage();
    const results: StoryDiff[] = [];
    const stored = existsSync(request.baselines) ? readdirSync(request.baselines) : [];
    const formerIds = new Map(request.stories.map((story) => [story.id, story.formerId]));
    for (const shot of shots) {
      const formerId = formerIds.get(shot.storyId);
      const formerName =
        formerId === undefined ? undefined : shotName({ story: { id: formerId }, name: shot.view });
      const baselineName = storedBaseline(stored, basename(shot.file), formerName);
      results.push(
        await diffOf(page, shot, { baselines: request.baselines, out: request.outDir, baselineName })
      );
    }
    // a story's baseline may still carry its former id (`storedBaseline`): it is kept, not removed
    const stories = request.stories.flatMap((story) =>
      story.formerId === undefined ? [story.id] : [story.id, story.formerId]
    );
    const owners = [request.component, request.formerComponent].flatMap((owner) =>
      owner === undefined ? [] : [owner]
    );
    const removed = [...new Set(owners.flatMap((owner) => removedBaselines(stored, owner, stories)))];
    for (const file of removed) {
      results.push({
        storyId: file.replace(/\.png$/, ""),
        view: "",
        status: "removed",
        changedPixels: 0,
        percent: 100,
        baseline: join(request.baselines, file),
        current: ""
      });
    }
    return { schema: 1, results };
  } finally {
    await browser.close();
    rmSync(taken, { recursive: true, force: true });
  }
};
