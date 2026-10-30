/**
 * The view applied to a frame's document: the declared switches that apply on the root (`switches.ts`), the root
 * font size, the backdrop drawn behind the story and the style sheets for the Styles setting.
 *
 * @module
 */

import type { StorySheets } from "@forgebook/story-format/source";

import { backdropSheet } from "../backdrops";
import type { CatalogueSettings } from "../catalogue";
import { switchValueOf, type ViewSwitch } from "../switches";
import { type LiveView, schemeOf, type ViewState } from "../viewState";

/** The id of the style sheet that draws the backdrop. */
const BACKDROP_STYLE_ID = "forgebook-backdrop-style";

/**
 * Draws a backdrop behind the story (D-644): its own style sheet in the document's head, made once and rewritten on
 * every change, empty for the page's own colour.
 *
 * @param document - the frame's document.
 * @param sheet - the backdrop's CSS.
 */
const applyBackdrop = (document: Document, sheet: string): void => {
  const existing = document.getElementById(BACKDROP_STYLE_ID);
  const style = existing ?? document.createElement("style");
  if (existing === null) {
    style.id = BACKDROP_STYLE_ID;
    document.head.append(style);
  }
  style.textContent = sheet;
};

/**
 * Sets or removes an attribute.
 *
 * @param root - the document's root element.
 * @param name - the attribute.
 * @param value - its value; none removes it.
 */
const setAttribute = (root: HTMLElement, name: string, value: string | undefined): void => {
  if (value === undefined) root.removeAttribute(name);
  else root.setAttribute(name, value);
};

/**
 * Sets the class of a switch's value, removing its other values' classes.
 *
 * @param root - the document's root element.
 * @param prefix - the classes' prefix.
 * @param each - the switch.
 * @param value - the value; none leaves no class.
 */
const setClass = (root: HTMLElement, prefix: string, each: ViewSwitch, value: string | undefined): void => {
  for (const candidate of each.values) root.classList.remove(`${prefix}${candidate.value}`);
  if (value !== undefined) root.classList.add(`${prefix}${value}`);
};

/**
 * Sets or removes a custom property.
 *
 * @param root - the document's root element.
 * @param name - the property (`--density`).
 * @param value - its value; none removes it.
 */
const setProperty = (root: HTMLElement, name: string, value: string | undefined): void => {
  if (value === undefined) root.style.removeProperty(name);
  else root.style.setProperty(name, value);
};

/**
 * Applies one declared switch on the root, when it applies there: its attribute, class, colour scheme or custom
 * property; a value marked unset writes nothing, so the library's own default shows. A switch applied by code reaches
 * the story instead (`context.globals`).
 *
 * @param root - the document's root element.
 * @param each - the switch.
 * @param value - its value in the view; none for its default.
 */
const applySwitch = (root: HTMLElement, each: ViewSwitch, value: string | undefined): void => {
  const shown = switchValueOf(each, value);
  const written = shown === undefined || shown.isUnset === true ? undefined : shown.value;
  const { apply } = each;
  if (apply.kind === "attribute") setAttribute(root, apply.name, written);
  if (apply.kind === "class") setClass(root, apply.prefix, each, written);
  if (apply.kind === "colorScheme") root.style.colorScheme = written ?? "";
  if (apply.kind === "cssVariable") setProperty(root, apply.name, written);
};

/**
 * Applies the view's live part on a document's root: each declared switch that applies there, the font size, and the
 * backdrop behind the story in the view's scheme.
 *
 * @param root - the document's root element.
 * @param view - the view's live part: the frame applies it again whenever the shell sends a change.
 * @param catalogue - the catalogue's switches and backdrops.
 */
export const applyView = (
  root: HTMLElement,
  view: LiveView,
  catalogue: Pick<CatalogueSettings, "switches" | "backdrops">
): void => {
  for (const each of catalogue.switches) applySwitch(root, each, view.switches[each.id]);
  root.style.fontSize = `${view.text}%`;
  const backdrop = catalogue.backdrops.find((each) => each.id === view.backdrop);
  applyBackdrop(root.ownerDocument, backdropSheet(backdrop, schemeOf(view, catalogue.switches)));
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
