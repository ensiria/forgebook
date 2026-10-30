/**
 * The view applied to a frame's document: the switches Kaji-style libraries read on the root, the root font size,
 * the backdrop drawn behind the story and the style sheets for the Styles setting.
 *
 * @module
 */

import type { StorySheets } from "@forgebook/story-format/source";

import { backdropSheet } from "../backdrops";
import type { BackdropChoice, LiveView, ViewState } from "../viewState";

/** The id of the style sheet that draws the backdrop. */
const BACKDROP_STYLE_ID = "forgebook-backdrop-style";

/**
 * Draws a backdrop behind the story (D-644): its own style sheet in the document's head, made once and rewritten on
 * every change, empty for the page's own colour.
 *
 * @param document - the frame's document.
 * @param backdrop - the backdrop.
 */
const applyBackdrop = (document: Document, backdrop: BackdropChoice): void => {
  const existing = document.getElementById(BACKDROP_STYLE_ID);
  const style = existing ?? document.createElement("style");
  if (existing === null) {
    style.id = BACKDROP_STYLE_ID;
    document.head.append(style);
  }
  style.textContent = backdropSheet(backdrop);
};

/**
 * Sets the switches on a document's root: `data-theme` (none for the system's), `data-contrast`,
 * `data-motion-amount` (none for the system's), `data-motion` (none for the normal speed), `data-press` (none for the
 * library's default) and the font size, and draws the backdrop behind the story.
 *
 * @param root - the document's root element.
 * @param view - the view's live part: the frame applies it again whenever the shell sends a change.
 */
export const applyView = (root: HTMLElement, view: LiveView): void => {
  if (view.theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", view.theme);
  root.setAttribute("data-contrast", view.isMoreContrast ? "more" : "standard");
  if (view.motion === "system") root.removeAttribute("data-motion-amount");
  else root.setAttribute("data-motion-amount", view.motion);
  if (view.speed === "normal") root.removeAttribute("data-motion");
  else root.setAttribute("data-motion", view.speed);
  if (view.press === "default") root.removeAttribute("data-press");
  else root.setAttribute("data-press", view.press);
  root.style.fontSize = `${view.text}%`;
  applyBackdrop(root.ownerDocument, view.backdrop);
};

/**
 * The style sheets a view loads, in order: the required ones, then the theme or the restyled look.
 *
 * @param sheets - the source's sheets.
 * @param view - the view.
 */
export const viewSheets = (sheets: StorySheets, view: ViewState): string[] => {
  if (view.sheets === "structure") return [...sheets.required];
  if (view.sheets === "restyled") return [...sheets.required, ...sheets.restyled];
  return [...sheets.required, ...sheets.theme];
};

/**
 * Loads style sheets into a document and waits for them, so the story never shows unstyled.
 *
 * @param document - the frame's document.
 * @param urls - the sheets, in order.
 */
export const loadSheets = async (document: Document, urls: readonly string[]): Promise<void> => {
  await Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve, reject) => {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = url;
          link.addEventListener("load", () => resolve());
          link.addEventListener("error", () => reject(new Error(`The style sheet ${url} did not load`)));
          document.head.append(link);
        })
    )
  );
};
