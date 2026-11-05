/**
 * What a story fixes of the view, as Storybook's stories write it: switches by its `globals` (`{ theme: "dark" }`),
 * the background by `globals.backgrounds` or `parameters.backgrounds.default`, the width by `globals.viewport` or
 * `parameters.viewport.defaultViewport`.
 *
 * @remarks
 * A story that fixes a value is drawn with it whatever the toolbar says, and the toolbar shows it as set by the story,
 * as Storybook locks a global a story sets. Only values the catalogue has are taken: a switch's value among its
 * values, a background by its id or name, a width by its preset's name or its number. The address keeps the user's
 * own view, so another story shows it again. Pure.
 *
 * @module
 */

import type { CatalogueSettings } from "./catalogue.ts";
import type { ViewState } from "./viewState.ts";

/** What a story fixes of the view; an empty `switches` and nothing else when it fixes nothing. */
export type FixedView = {
  /** The switches it fixes, by id. */
  readonly switches: Readonly<Record<string, string>>;
  /** The backdrop it fixes, by id. */
  readonly backdrop?: string;
  /** The width it fixes, in CSS px. */
  readonly width?: number;
};

/** A story that fixes nothing. */
export const NOT_FIXED: FixedView = { switches: {} };

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A field of an object that is itself an object, or an empty one. */
const recordAt = (
  part: Readonly<Record<string, unknown>>,
  name: string
): Readonly<Record<string, unknown>> => {
  const value = part[name];
  return isRecord(value) ? value : {};
};

/** A global written as Storybook's addons write theirs (`{ value: "dark" }`) or as a plain text. */
const globalValue = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  return isRecord(value) && typeof value["value"] === "string" ? value["value"] : undefined;
};

/** The same text, compared without case. */
const isSameName = (left: string, right: string): boolean => left.toLowerCase() === right.toLowerCase();

/**
 * The backdrop a name picks: by the catalogue's id or name.
 *
 * @param name - the story's background, by id or name.
 * @param catalogue - the catalogue's backdrops.
 */
const backdropNamed = (name: string, catalogue: Pick<CatalogueSettings, "backdrops">): string | undefined =>
  catalogue.backdrops.find((backdrop) => isSameName(backdrop.id, name) || isSameName(backdrop.label, name))
    ?.id;

/**
 * The width a name picks: a preset by its name, or a number of CSS px among the presets.
 *
 * @param name - the story's viewport, by name or width.
 * @param catalogue - the catalogue's widths.
 */
const widthNamed = (name: string, catalogue: Pick<CatalogueSettings, "widths">): number | undefined =>
  catalogue.widths.find(
    (preset) =>
      (preset.label !== undefined && isSameName(preset.label, name)) ||
      String(preset.width) === name.replace(/px$/, "")
  )?.width;

/**
 * What a story fixes of the view.
 *
 * @param globals - the story's `globals`, the meta's under its own.
 * @param parameters - the story's parameters.
 * @param catalogue - the catalogue's switches, backdrops and widths.
 */
export const fixedViewOf = (
  globals: Readonly<Record<string, unknown>>,
  parameters: Readonly<Record<string, unknown>>,
  catalogue: Pick<CatalogueSettings, "switches" | "backdrops" | "widths">
): FixedView => {
  const switches = Object.fromEntries(
    catalogue.switches.flatMap((each) => {
      const value = globalValue(globals[each.id]);
      return value !== undefined && each.values.some((known) => known.value === value)
        ? [[each.id, value]]
        : [];
    })
  );
  const background =
    globalValue(globals["backgrounds"]) ?? globalValue(recordAt(parameters, "backgrounds")["default"]);
  const viewport =
    globalValue(globals["viewport"]) ?? globalValue(recordAt(parameters, "viewport")["defaultViewport"]);
  const backdrop = background === undefined ? undefined : backdropNamed(background, catalogue);
  const width = viewport === undefined ? undefined : widthNamed(viewport, catalogue);
  return {
    switches,
    ...(backdrop === undefined ? {} : { backdrop }),
    ...(width === undefined ? {} : { width })
  };
};

/** The parts of a view a story can fix. */
type FixableView = Pick<ViewState, "switches" | "backdrop">;

/**
 * A view with what the story fixes over it: what it is drawn with and what the toolbar shows.
 *
 * @param view - the view.
 * @param fixed - what the story fixes.
 */
export const withFixed = <TView extends FixableView & Partial<Pick<ViewState, "width">>>(
  view: TView,
  fixed: FixedView
): TView => ({
  ...view,
  // the same object when the story fixes no switch: a new one would tell the frames of a view that did not change
  switches:
    Object.keys(fixed.switches).length === 0 ? view.switches : { ...view.switches, ...fixed.switches },
  ...(fixed.backdrop === undefined ? {} : { backdrop: fixed.backdrop }),
  ...(fixed.width === undefined || view.width === undefined ? {} : { width: fixed.width })
});

/**
 * A view changed from the one shown, with the user's own values back where the story fixes them: a change of another
 * setting never writes the story's into the address.
 *
 * @param changed - the view as the toolbar changed it, from the one shown.
 * @param own - the user's own view.
 * @param fixed - what the story fixes.
 */
export const withOwnFixed = (changed: ViewState, own: ViewState, fixed: FixedView): ViewState => {
  const switches: Record<string, string> = { ...changed.switches };
  for (const id of Object.keys(fixed.switches)) {
    const ownValue = own.switches[id];
    if (ownValue === undefined) delete switches[id];
    else switches[id] = ownValue;
  }
  return {
    ...changed,
    switches,
    backdrop: fixed.backdrop === undefined ? changed.backdrop : own.backdrop,
    width: fixed.width === undefined ? changed.width : own.width
  };
};

/**
 * Whether a value received from a frame is what a story fixes.
 *
 * @param value - the message's field.
 */
export const isFixedView = (value: unknown): value is FixedView =>
  isRecord(value) &&
  isRecord(value["switches"]) &&
  Object.values(value["switches"]).every((switchValue) => typeof switchValue === "string") &&
  (value["backdrop"] === undefined || typeof value["backdrop"] === "string") &&
  (value["width"] === undefined || typeof value["width"] === "number");
