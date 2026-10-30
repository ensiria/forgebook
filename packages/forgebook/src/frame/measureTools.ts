/**
 * The tools drawn over a story in its frame: every element's outline, a grid (8 px by default, the catalogue's step), and the box of the element under
 * the pointer with its size, padding and margin.
 *
 * @remarks
 * The tools sit on top of the story and never change its layout: the outlines are CSS outlines (they take no room),
 * the grid and the measured box are overlays that let the pointer through. The outlines and the measure reach every
 * element of the frame's body, not only the story's root: a popover, a menu or a dialog is mounted beside the root (a
 * portal), and the catalogue does not know how each library names its container. The shell sends the tools as a message
 * (`forgebook:tools`), so turning one on never loads the frame again. The overlay's colours are fixed, not the
 * source's: it must read over any theme.
 *
 * @module
 */
import type { MeasureTool } from "../viewState.ts";

/** The id of the style sheet that draws the outlines and the grid. */
const STYLE_ID = "forgebook-measure-style";

/** The id of the overlay that draws the measured box. */
const OVERLAY_ID = "forgebook-measure-overlay";

/**
 * The sheet for the outline and the grid tools.
 *
 * @param tools - the tools drawn.
 * @param gridStep - the grid's step, in CSS px.
 */
const toolSheet = (tools: readonly MeasureTool[], gridStep: number): string =>
  [
    tools.includes("outline")
      ? `body *:not(#root, #${OVERLAY_ID}, #${OVERLAY_ID} *) { ` +
        "outline: 1px solid rgb(232 62 140 / 0.55) !important; outline-offset: -1px !important; }"
      : "",
    tools.includes("grid")
      ? "#root { background-image: linear-gradient(rgb(23 104 228 / 0.12) 1px, transparent 1px), " +
        "linear-gradient(90deg, rgb(23 104 228 / 0.12) 1px, transparent 1px) !important; " +
        `background-size: ${gridStep}px ${gridStep}px !important; }`
      : ""
  ].join("\n");

/** A length in CSS px, written short. */
const px = (value: number): string => `${Math.round(value * 10) / 10}`;

/** The overlay of the measured box, made once. */
const overlayOf = (document: Document): HTMLElement => {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing !== null) return existing;
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("aria-hidden", "true");
  Object.assign(overlay.style, {
    position: "fixed",
    zIndex: "2147483647",
    pointerEvents: "none",
    boxSizing: "border-box",
    display: "none"
  });
  document.body.append(overlay);
  return overlay;
};

/** Draws an element's box on the overlay: its padding and margin shaded, its size in a label. */
const drawBox = (overlay: HTMLElement, element: Element): void => {
  const view = element.ownerDocument.defaultView;
  if (view === null) return;
  const rect = element.getBoundingClientRect();
  const style = view.getComputedStyle(element);
  const sides = ["top", "right", "bottom", "left"];
  const lengths = (property: string): number[] =>
    sides.map((side) => Number.parseFloat(style.getPropertyValue(`${property}-${side}`)) || 0);
  const margin = lengths("margin");
  const padding = lengths("padding");
  const [mt = 0, mr = 0, mb = 0, ml = 0] = margin;
  const [pt = 0, pr = 0, pb = 0, pl = 0] = padding;
  Object.assign(overlay.style, {
    display: "block",
    left: `${rect.left - ml}px`,
    top: `${rect.top - mt}px`,
    width: `${rect.width + ml + mr}px`,
    height: `${rect.height + mt + mb}px`,
    // the margin in orange, the padding in green, the content in blue: the colours browsers' inspectors use
    borderStyle: "solid",
    borderColor: "rgb(246 178 107 / 0.5)",
    borderWidth: `${mt}px ${mr}px ${mb}px ${ml}px`,
    background: "rgb(147 196 125 / 0.45)",
    backgroundClip: "padding-box"
  });
  overlay.innerHTML = "";
  const content = overlay.ownerDocument.createElement("div");
  Object.assign(content.style, {
    position: "absolute",
    left: `${pl}px`,
    top: `${pt}px`,
    right: `${pr}px`,
    bottom: `${pb}px`,
    background: "rgb(111 168 220 / 0.55)"
  });
  const label = overlay.ownerDocument.createElement("div");
  label.textContent = `${px(rect.width)} × ${px(rect.height)}`;
  Object.assign(label.style, {
    position: "absolute",
    left: "0",
    top: rect.top - mt >= 20 ? "-20px" : "100%",
    padding: "1px 5px",
    borderRadius: "3px",
    background: "#1d1d1f",
    color: "#fff",
    font: "500 11px/16px ui-monospace, SFMono-Regular, Menlo, monospace",
    whiteSpace: "nowrap"
  });
  overlay.append(content, label);
};

/** Stops measuring: the listener a call of `applyTools` added, if any. */
let stopMeasuring: (() => void) | undefined;

/**
 * Draws the tools over the story, replacing the ones drawn before.
 *
 * @param document - the frame's document.
 * @param tools - the tools to draw; none removes them all.
 * @param gridStep - the grid's step, in CSS px; 8 by default.
 */
export const applyTools = (document: Document, tools: readonly MeasureTool[], gridStep = 8): void => {
  const sheet = toolSheet(tools, gridStep);
  let style = document.getElementById(STYLE_ID);
  if (style === null) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.append(style);
  }
  style.textContent = sheet;
  stopMeasuring?.();
  stopMeasuring = undefined;
  const overlay = overlayOf(document);
  overlay.style.display = "none";
  if (!tools.includes("measure")) return;
  const measure = (event: PointerEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    // the story's elements and its portals: anything in the body but the root itself and the overlay
    const isStoryElement =
      target !== null &&
      target !== document.body &&
      target.id !== "root" &&
      document.body.contains(target) &&
      !overlay.contains(target);
    if (!isStoryElement) {
      overlay.style.display = "none";
      return;
    }
    drawBox(overlay, target);
  };
  const hide = (): void => {
    overlay.style.display = "none";
  };
  document.addEventListener("pointermove", measure);
  document.addEventListener("pointerleave", hide);
  stopMeasuring = (): void => {
    document.removeEventListener("pointermove", measure);
    document.removeEventListener("pointerleave", hide);
  };
};
