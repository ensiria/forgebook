/**
 * The overlays a story leaves open past its frame: what a frame as tall as the story would cut or push to the other
 * side, so the story needs `parameters.height` (D-469).
 *
 * @remarks
 * The catalogue sizes a story's frame to its document's body, and the window of the frame is the overlays' window;
 * the tests open the frame in a window taller than that, where an overlay opened near the story's foot still fits. So
 * after the play an overlay is measured against the frame the shell would give it: the body's height, or the height
 * the story declares when that is more. Without knowing
 * the library (D-67), an overlay is any element with `position: fixed` that shows (a box, not hidden, not
 * transparent) and whose box ends more than a pixel below the body. A fixed element placed against the window rather
 * than against what opened it (a full-window layer, a toast region pinned to the window's foot, a drawer) is told
 * apart by covering the window's whole height, or by growing the window: it moves or grows with it, an anchored
 * overlay stays where it is.
 *
 * Limits: an overlay that is not `position: fixed` (an absolute popover inside the story) is not seen; an overlay the
 * library shrinks to the room there is (a list that scrolls in the frame) fits and is not flagged, though it may be
 * cramped; only the state after the play is measured, not what opens and closes during it; and an anchored overlay
 * the library fits to the test's window (a list as tall as the room below it) grows with the window and reads as
 * pinned to it, which takes a list taller than the test's window.
 *
 * @module
 */
import type { Page } from "@playwright/test";

import type { ViewState } from "../viewState";

/** A shown fixed element's box, in CSS px from the window's top. */
export type FixedBox = {
  /** The element, as a short CSS path (`div.kaji-menu`), with its order among the elements of that path (`#0`). */
  readonly key: string;
  /** Its top edge. */
  readonly top: number;
  /** Its bottom edge. */
  readonly bottom: number;
};

/** The frame's height as the shell gives it, and every shown fixed element. */
export type FixedLayout = {
  /** The height the shell gives the story's frame, in CSS px: the body's, or the declared one when more. */
  readonly frameHeight: number;
  /** The window's height, in CSS px. */
  readonly windowHeight: number;
  /** Every shown `position: fixed` element, in document order. */
  readonly boxes: readonly FixedBox[];
};

/** An overlay that reaches past the frame. */
export type OverlayPastFrame = {
  /** The element, as `FixedBox.key` names it. */
  readonly element: string;
  /** How far its box ends below the frame's foot, in whole CSS px. */
  readonly by: number;
  /** The frame's height, in CSS px. */
  readonly frameHeight: number;
};

/** How much taller the window is made to tell the elements pinned to it, in CSS px. */
export const WINDOW_GROWTH = 120;

/** How far past the frame's foot a box may end without counting, in CSS px: rounding. */
const TOLERANCE = 1;

/**
 * The frame's height and every shown fixed element, measured in the story's page (`page.evaluate`), so it takes no
 * import.
 */
export const fixedLayout = (): FixedLayout => {
  const pathOf = (element: Element): string => {
    const classes = [...element.classList].slice(0, 2).join(".");
    return classes === "" ? element.tagName.toLowerCase() : `${element.tagName.toLowerCase()}.${classes}`;
  };
  const counts = new Map<string, number>();
  const boxes: FixedBox[] = [];
  for (const element of document.body.querySelectorAll("*")) {
    const style = getComputedStyle(element);
    if (style.position !== "fixed" || style.visibility === "hidden" || style.opacity === "0") continue;
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    const path = pathOf(element);
    const count = counts.get(path) ?? 0;
    counts.set(path, count + 1);
    boxes.push({ key: `${path}#${count}`, top: box.top, bottom: box.bottom });
  }
  return {
    frameHeight: Math.ceil(document.body.getBoundingClientRect().height),
    windowHeight: window.innerHeight,
    boxes
  };
};

/**
 * Whether a box ends below the frame's foot.
 *
 * @param box - the box.
 * @param frameHeight - the frame's height.
 */
const endsPast = (box: FixedBox, frameHeight: number): boolean => box.bottom > frameHeight + TOLERANCE;

/**
 * The overlays past the frame, from the layout after the play and the same layout in a window grown by `growth`.
 *
 * @param layout - the layout after the play.
 * @param grown - the layout once the window is `growth` px taller; none counts every box as anchored.
 * @param growth - how much taller the grown window is, in CSS px.
 * @returns the boxes that end past the frame and did not follow the window's foot. Pure.
 */
export const overlaysPastFrame = (
  layout: FixedLayout,
  grown: FixedLayout | undefined,
  growth: number
): OverlayPastFrame[] => {
  const grownBoxes = new Map((grown?.boxes ?? []).map((box) => [box.key, box]));
  return layout.boxes.flatMap((box) => {
    if (!endsPast(box, layout.frameHeight)) return [];
    const after = grownBoxes.get(box.key);
    // a layer over the whole window, or a box that moved or grew with the window's foot: placed against the window,
    // not against what opened it (a layer whose overlay closed on the resize is gone from the grown layout)
    const isWindowLayer = box.top <= TOLERANCE && box.bottom >= layout.windowHeight - TOLERANCE;
    const isPinnedToWindow = after !== undefined && after.bottom - box.bottom >= growth / 2;
    if (isWindowLayer || isPinnedToWindow) return [];
    return [
      { element: box.key, by: Math.round(box.bottom - layout.frameHeight), frameHeight: layout.frameHeight }
    ];
  });
};

/**
 * Whether a view is checked for overlays left past the frame: not with the structure sheets only, where a library's
 * surfaces are bare by its own rules (sizes are look, so an overlay has no cap and no width there), so no declared
 * height could hold them.
 *
 * @param view - the switches a test variant sets over the defaults.
 * @returns `false` for a structure-only view, `true` otherwise.
 */
export const isOverlayChecked = (view: Partial<ViewState>): boolean => view.sheets !== "structure";

/** Waits for two frames of the page, so a resize has been laid out and anything that follows it has moved. */
const twoFrames = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/**
 * The overlays a story's page leaves open past its frame, measured once its play is over.
 *
 * @param page - the story's frame page, ready.
 * @param sceneHeight - the height the story declares (`parameters.height`), in CSS px; none by default.
 * @returns one entry per overlay that ends below the frame's foot; the window is grown and given back only when a
 * fixed element ends there.
 */
export const findOverlaysPastFrame = async (page: Page, sceneHeight = 0): Promise<OverlayPastFrame[]> => {
  const measure = async (): Promise<FixedLayout> => {
    const measured = await page.evaluate(fixedLayout);
    return { ...measured, frameHeight: Math.max(measured.frameHeight, sceneHeight) };
  };
  const layout = await measure();
  if (!layout.boxes.some((box) => endsPast(box, layout.frameHeight))) return [];
  const size = page.viewportSize();
  if (size === null) return overlaysPastFrame(layout, undefined, WINDOW_GROWTH);
  await page.setViewportSize({ width: size.width, height: size.height + WINDOW_GROWTH });
  await page.evaluate(twoFrames);
  const grown = await measure();
  await page.setViewportSize(size);
  await page.evaluate(twoFrames);
  return overlaysPastFrame(layout, grown, WINDOW_GROWTH);
};
