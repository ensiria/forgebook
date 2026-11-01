/**
 * Named views: the View menu's values saved under a name ("Dark, Italian, 360") and picked again. A reader's, kept in
 * their browser, and the catalogue's own (`views` in its configuration), offered to the whole team.
 *
 * @remarks
 * A named view holds values, never an arrangement: the switches, the background, the style sheets, the text size and
 * the width. Picking one sets them as choosing each would, so the address carries the values; a name never goes in the
 * address, since another reader may not have it. Pure: views in, views out.
 *
 * @module
 */
import { parseView, type ViewCatalogue, type ViewState, viewParams } from "./viewState.ts";

/** The values a named view holds: the View menu's. */
export type ViewValues = Pick<ViewState, "switches" | "backdrop" | "sheets" | "text" | "width">;

/** A view saved under a name. */
export type NamedView = {
  /** Its name, as the reader or the catalogue wrote it. */
  readonly name: string;
  /** Its values. */
  readonly values: ViewValues;
};

/** A view the catalogue declares, as its configuration writes it. */
export type CatalogueView = {
  /** Its name. */
  readonly name: string;
  /** Its values, in the address's form (`theme=dark&width=360`) or as words (`"dark it 360"`). */
  readonly view: string;
};

/**
 * The values of a view that a named view holds.
 *
 * @param view - the view.
 */
export const viewValues = (view: ViewState): ViewValues => ({
  switches: view.switches,
  backdrop: view.backdrop,
  sheets: view.sheets,
  text: view.text,
  width: view.width
});

/**
 * The view with a named view's values set.
 *
 * @param view - the view shown.
 * @param values - the named view's values.
 */
export const withViewValues = (view: ViewState, values: ViewValues): ViewState => ({ ...view, ...values });

/**
 * The reader's views with one saved: a view of the same name is replaced where it was, a new one goes last.
 *
 * @param views - the reader's views.
 * @param saved - the view saved; its name trimmed.
 * @returns the views; the same ones for an empty name.
 */
export const withSavedView = (views: readonly NamedView[], saved: NamedView): NamedView[] => {
  const name = saved.name.trim();
  if (name === "") return [...views];
  const view = { ...saved, name };
  return views.some((each) => each.name === name)
    ? views.map((each) => (each.name === name ? view : each))
    : [...views, view];
};

/**
 * The reader's views without one.
 *
 * @param views - the reader's views.
 * @param name - the removed view's name.
 */
export const withoutView = (views: readonly NamedView[], name: string): NamedView[] =>
  views.filter((each) => each.name !== name);

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is a named view's values, as this module stores them. */
const isViewValues = (value: unknown): value is ViewValues =>
  isRecord(value) &&
  isRecord(value["switches"]) &&
  Object.values(value["switches"]).every((each) => typeof each === "string") &&
  typeof value["backdrop"] === "string" &&
  (value["sheets"] === "full" || value["sheets"] === "structure" || value["sheets"] === "restyled") &&
  typeof value["text"] === "number" &&
  (value["width"] === "fill" || typeof value["width"] === "number");

/**
 * The reader's views a stored text holds; the ones this module did not write are left out.
 *
 * @param stored - the stored text, or none.
 */
export const readNamedViews = (stored: string | null): NamedView[] => {
  if (stored === null || stored === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return [];
  }
  return (Array.isArray(parsed) ? parsed : []).filter(
    (each): each is NamedView =>
      isRecord(each) && typeof each["name"] === "string" && isViewValues(each["values"])
  );
};

/**
 * The text the reader's views are stored as; empty for none.
 *
 * @param views - the reader's views.
 */
export const namedViewsText = (views: readonly NamedView[]): string =>
  views.length === 0 ? "" : JSON.stringify(views);

/**
 * Whether two sets of values draw the same view: a switch left at its default and one set to it are the same.
 *
 * @param first - one set.
 * @param second - the other.
 * @param switches - the catalogue's switches, for their defaults.
 */
export const isSameView = (
  first: ViewValues,
  second: ViewValues,
  switches: readonly { readonly id: string; readonly default: string }[]
): boolean =>
  switches.every(
    (each) => (first.switches[each.id] ?? each.default) === (second.switches[each.id] ?? each.default)
  ) &&
  first.backdrop === second.backdrop &&
  first.sheets === second.sheets &&
  first.text === second.text &&
  first.width === second.width;

/**
 * A view with a named view's values read back as an address is: what the catalogue no longer offers (a background, a
 * text size, a control it turned off) falls back to its default, so a view saved before the catalogue changed never
 * sets what the catalogue cannot show.
 *
 * @param view - the view with the named view's values set.
 * @param catalogue - the catalogue's switches and lists.
 */
export const checkedView = (view: ViewState, catalogue: ViewCatalogue): ViewState => ({
  ...view,
  ...viewValues(parseView(viewParams(view, catalogue.switches).toString(), catalogue))
});
