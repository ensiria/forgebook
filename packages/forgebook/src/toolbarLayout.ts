/**
 * Where each control of the toolbar and the View menu sits for the person using a catalogue: whether it is pinned on
 * the toolbar, whether it is hidden in the View menu, and one order both follow.
 *
 * @remarks
 * Two levels, kept apart: the catalogue decides which controls exist (its switches, and Forgebook's own it did not turn
 * off) and which start on the toolbar; the person decides where each one shows and in what order. Pinned and hidden
 * are two choices, not one: a control can sit on the toolbar and take no row in the View menu, sit in both, sit in
 * the View menu only, or show nowhere (its value still applies from the address; it only takes no room, and the
 * menu's hidden list still reaches it). The arrangement is a convenience of the person's, kept in their browser
 * (`useStored`), never in the address: a link shares the values, not how someone arranged their bar. A stored
 * arrangement is resolved against the catalogue as it is now: a control it no longer has is dropped, a new one goes to
 * the View menu, at the end. Pure.
 *
 * @module
 */

import type { CatalogueSettings, OwnControlId } from "./catalogue.ts";
import type { ViewSwitch } from "./switches.ts";

/** A control of the toolbar and the View menu: one of the catalogue's switches, or one of Forgebook's own. */
export type ToolbarControl =
  | {
      /** A switch the catalogue declares. */
      readonly kind: "switch";
      /** The switch's id. */
      readonly id: string;
      /** The switch. */
      readonly switch: ViewSwitch;
    }
  | {
      /** One of Forgebook's own controls. */
      readonly kind: "own";
      /** The control's id. */
      readonly id: OwnControlId;
    };

/** A control and where it shows. */
export type PlacedControl = {
  /** The control. */
  readonly control: ToolbarControl;
  /** Whether it sits on the toolbar. */
  readonly isPinned: boolean;
  /** Whether it takes no row in the View menu (its hidden list still holds it). */
  readonly isHidden: boolean;
};

/** A person's arrangement, as their browser keeps it: every control's id in their order, and the pinned and hidden. */
export type ToolbarArrangement = {
  /** The controls' ids, in the order the View menu lists them and the toolbar shows the pinned ones. */
  readonly order: readonly string[];
  /** The ids of the controls on the toolbar. */
  readonly pinned: readonly string[];
  /** The ids of the controls hidden in the View menu. */
  readonly hidden: readonly string[];
};

/** The part of a catalogue's settings the arrangement reads. */
type ArrangedCatalogue = Pick<CatalogueSettings, "switches" | "ownControls" | "toolbar">;

/**
 * Every control a catalogue shows, in its own order: its switches as it declares them, then Forgebook's own.
 *
 * @param catalogue - the catalogue's switches and controls.
 */
export const catalogueControls = (
  catalogue: Pick<CatalogueSettings, "switches" | "ownControls">
): ToolbarControl[] => [
  ...catalogue.switches.map((each): ToolbarControl => ({ kind: "switch", id: each.id, switch: each })),
  ...catalogue.ownControls.map((id): ToolbarControl => ({ kind: "own", id }))
];

/**
 * The controls as the catalogue places them before a person arranges anything: those it starts on the toolbar first,
 * in its order and pinned, then the others, in their own order; none hidden.
 *
 * @param catalogue - the catalogue's switches, controls and starting toolbar.
 */
export const defaultControls = (catalogue: ArrangedCatalogue): PlacedControl[] => {
  const controls = catalogueControls(catalogue);
  const pinned = catalogue.toolbar.flatMap((id) => controls.filter((control) => control.id === id));
  return [
    ...pinned.map((control): PlacedControl => ({ control, isPinned: true, isHidden: false })),
    ...controls
      .filter((control) => !catalogue.toolbar.includes(control.id))
      .map((control): PlacedControl => ({ control, isPinned: false, isHidden: false }))
  ];
};

/**
 * The controls placed by a person's arrangement, or by the catalogue when there is none: the arrangement's controls
 * the catalogue still has, in its order, then the catalogue's new ones in the View menu.
 *
 * @param catalogue - the catalogue's switches, controls and starting toolbar.
 * @param arrangement - the person's arrangement, when they made one.
 */
export const placedControls = (
  catalogue: ArrangedCatalogue,
  arrangement: ToolbarArrangement | undefined
): PlacedControl[] => {
  if (arrangement === undefined) return defaultControls(catalogue);
  const controls = catalogueControls(catalogue);
  const kept = arrangement.order.flatMap((id) =>
    controls
      .filter((control) => control.id === id)
      .map(
        (control): PlacedControl => ({
          control,
          isPinned: arrangement.pinned.includes(id),
          isHidden: arrangement.hidden.includes(id)
        })
      )
  );
  const added = controls
    .filter((control) => !arrangement.order.includes(control.id))
    .map((control): PlacedControl => ({ control, isPinned: false, isHidden: false }));
  return [...kept, ...added];
};

/**
 * The arrangement that places the controls as they are.
 *
 * @param placed - the placed controls.
 */
export const arrangementOf = (placed: readonly PlacedControl[]): ToolbarArrangement => ({
  order: placed.map((each) => each.control.id),
  pinned: placed.filter((each) => each.isPinned).map((each) => each.control.id),
  hidden: placed.filter((each) => each.isHidden).map((each) => each.control.id)
});

/**
 * The controls with one pinned on the toolbar or taken off it, keeping its position in the order.
 *
 * @param placed - the placed controls.
 * @param id - the control's id.
 * @param isPinned - whether it sits on the toolbar.
 */
export const withPinned = (
  placed: readonly PlacedControl[],
  id: string,
  isPinned: boolean
): PlacedControl[] => placed.map((each) => (each.control.id === id ? { ...each, isPinned } : each));

/**
 * The controls with one hidden in the View menu or shown there again, keeping its position in the order.
 *
 * @param placed - the placed controls.
 * @param id - the control's id.
 * @param isHidden - whether it takes no row in the View menu.
 */
export const withHidden = (
  placed: readonly PlacedControl[],
  id: string,
  isHidden: boolean
): PlacedControl[] => placed.map((each) => (each.control.id === id ? { ...each, isHidden } : each));

/**
 * The controls with one moved to a position among the View menu's rows (hidden ones left out); a hidden control
 * keeps its position in the whole order, so showing it again brings it back where it was.
 *
 * @param placed - the placed controls.
 * @param id - the moved control's id; a hidden one or an unknown one leaves the order as it is.
 * @param index - its new position among the shown controls, clamped to them.
 */
export const withPosition = (
  placed: readonly PlacedControl[],
  id: string,
  index: number
): PlacedControl[] => {
  const shown = placed.filter((each) => !each.isHidden);
  const moved = shown.find((each) => each.control.id === id);
  if (moved === undefined) return [...placed];
  const others = shown.filter((each) => each !== moved);
  const at = Math.min(Math.max(index, 0), others.length);
  const reordered = [...others.slice(0, at), moved, ...others.slice(at)];
  // the shown controls take the shown positions, in their new order; the hidden ones stay where they were
  let next = 0;
  return placed.map((each) => {
    if (each.isHidden) return each;
    const taken = reordered[next] ?? each;
    next += 1;
    return taken;
  });
};

/**
 * The strings of a list read back, the rest left out.
 *
 * @param value - what the stored text holds there.
 */
const idsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];

/**
 * A stored arrangement read back, or none when the text holds none or not one this module wrote (an older format,
 * an edit by hand): the catalogue's placing then applies.
 *
 * @param stored - the stored text, or none.
 */
export const readArrangement = (stored: string | null): ToolbarArrangement | undefined => {
  if (stored === null || stored === "") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  if (!("order" in parsed) || !Array.isArray(parsed.order)) return undefined;
  if (!("pinned" in parsed) || !Array.isArray(parsed.pinned)) return undefined;
  if (!("hidden" in parsed) || !Array.isArray(parsed.hidden)) return undefined;
  return { order: idsOf(parsed.order), pinned: idsOf(parsed.pinned), hidden: idsOf(parsed.hidden) };
};

/**
 * The text an arrangement is stored as; empty for none, so the catalogue's placing applies.
 *
 * @param arrangement - the arrangement, or none.
 */
export const arrangementText = (arrangement: ToolbarArrangement | undefined): string =>
  arrangement === undefined ? "" : JSON.stringify(arrangement);
