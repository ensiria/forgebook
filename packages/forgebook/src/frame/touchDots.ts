/**
 * The simulated fingers drawn in the frame: the real cursor hidden, a round translucent dot where each finger is,
 * smaller while it presses, as a tablet's pointer and Chromium's device mode show a touch.
 *
 * @remarks
 * The dots sit above the story and let every press through (`pointer-events: none`); their colours are fixed, not the
 * source's, so they read over any theme.
 *
 * @module
 */
import type { Point } from "./touchGesture.ts";

/** The id of the style sheet that hides the cursor and draws the dots. */
const STYLE_ID = "forgebook-touch-style";

/** The class of a dot. */
const DOT_CLASS = "forgebook-touch-dot";

/** The dots' sheet: the cursor hidden while touch is simulated, the dots' look. */
const DOTS_SHEET = [
  "html[data-forgebook-touch], html[data-forgebook-touch] * { cursor: none !important; }",
  `.${DOT_CLASS} { position: fixed; z-index: 2147483647; top: 0; left: 0; width: 28px; height: 28px; ` +
    "margin: -14px 0 0 -14px; border-radius: 50%; box-sizing: border-box; pointer-events: none; " +
    "background: rgb(255 255 255 / 0.55); border: 1.5px solid rgb(0 0 0 / 0.35); " +
    "box-shadow: 0 1px 4px rgb(0 0 0 / 0.25); transition: scale 80ms ease-out, background-color 80ms ease-out; }",
  `.${DOT_CLASS}[data-pressed] { scale: 0.75; background: rgb(210 210 210 / 0.75); }`,
  `.${DOT_CLASS}[hidden] { display: none; }`,
  "@media (prefers-reduced-motion: reduce) { .forgebook-touch-dot { transition: none; } }"
].join("\n");

/** The dots of a frame. */
export type TouchDots = {
  /**
   * Draws the dots: one per point, each pressed or not; none hides them.
   *
   * @param points - where each finger is, and whether it presses.
   */
  readonly draw: (points: readonly { readonly point: Point; readonly isPressed: boolean }[]) => void;
  /** Removes the dots and shows the cursor again. */
  readonly remove: () => void;
};

/**
 * The dots of a frame's document.
 *
 * @param document - the frame's document.
 */
export const touchDots = (document: Document): TouchDots => {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = DOTS_SHEET;
  document.head.append(style);
  const dots = [0, 1].map(() => {
    const dot = document.createElement("div");
    dot.className = DOT_CLASS;
    dot.setAttribute("aria-hidden", "true");
    dot.hidden = true;
    document.body.append(dot);
    return dot;
  });
  return {
    draw: (points: readonly { readonly point: Point; readonly isPressed: boolean }[]): void => {
      dots.forEach((dot, index) => {
        const each = points[index];
        dot.hidden = each === undefined;
        if (each === undefined) return;
        dot.style.translate = `${each.point.x}px ${each.point.y}px`;
        dot.toggleAttribute("data-pressed", each.isPressed);
      });
    },
    remove: (): void => {
      style.remove();
      for (const dot of dots) dot.remove();
    }
  };
};
