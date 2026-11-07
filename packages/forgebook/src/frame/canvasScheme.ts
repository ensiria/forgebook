/**
 * Tells the shell the colour scheme a frame's document draws in, so the frame element can have the same one.
 *
 * @remarks
 * A browser paints an opaque canvas behind an embedded document when its used colour scheme differs from its frame
 * element's: white for a light document, near black for a dark one, over the page colour the shell draws behind the
 * frame. Which scheme the document draws in is its own business (a theme's `color-scheme`, a `meta` tag, the system's
 * preference), and only the document can read it; writing a scheme on the document instead would change how the story
 * draws its controls.
 *
 * @module
 */

import type { FrameMessage } from "../messages.ts";

/** A colour scheme a document draws in. */
export type CanvasScheme = "light" | "dark";

/** Red, green and blue summed above this is a light canvas: browsers keep theirs near white or near black. */
const LIGHT_CANVAS_SUM = 382;

/**
 * The scheme a canvas colour belongs to.
 *
 * @param colour - the computed colour of `Canvas`, as `rgb(18, 18, 18)`.
 * @returns the scheme; light when the text is not a colour, as a document that declares no scheme draws.
 */
export const schemeOfCanvas = (colour: string): CanvasScheme => {
  const channels = colour.match(/\d+(?:\.\d+)?/g)?.slice(0, 3) ?? [];
  const sum = channels.reduce((total, channel) => total + Number(channel), 0);
  return channels.length === 3 && sum <= LIGHT_CANVAS_SUM ? "dark" : "light";
};

/**
 * The scheme a document draws in, read from what its `Canvas` system colour resolves to: this takes in `color-scheme`
 * with several values, the system's preference and a `meta` tag, which the computed property alone does not say.
 *
 * @param document - the document.
 * @param window - its window.
 */
const usedScheme = (document: Document, window: Window): CanvasScheme => {
  // in the `head`, where no story's observer of the page sees it come and go; it inherits the root's scheme
  const probe = document.createElement("meta");
  probe.style.color = "Canvas";
  document.head.append(probe);
  const colour = window.getComputedStyle(probe).color;
  probe.remove();
  return schemeOfCanvas(colour);
};

/**
 * Follows the scheme a frame's document draws in: tells it now, and again when it changes with the root (a switch, a
 * theme's class), a style sheet that finished loading, or the system's preference.
 *
 * @param document - the frame's document.
 * @param window - its window.
 * @param storyId - the story's id, for the shell.
 * @param tellShell - tells the shell, once for each change.
 * @returns what checks it again, for what no event says: styles a story's module brought with it.
 */
export const followCanvasScheme = (
  document: Document,
  window: Window,
  storyId: string,
  tellShell: (message: FrameMessage) => void
): (() => void) => {
  let told: CanvasScheme | undefined;
  const check = (): void => {
    const scheme = usedScheme(document, window);
    if (scheme === told) return;
    told = scheme;
    tellShell({ type: "forgebook:scheme", storyId, scheme });
  };
  new MutationObserver(check).observe(document.documentElement, { attributes: true });
  // a `load` does not bubble: seen on its way down, as a `link` of the `head` finishes
  document.addEventListener("load", check, true);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", check);
  check();
  return check;
};
