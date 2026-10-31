/**
 * The person's arrangement of the toolbar, kept in their browser per catalogue: where each control sits, in what
 * order, whether a full bar wraps, and the changes the View menu and the toolbar's controls make to it.
 *
 * @module
 */

import {
  arrangementOf,
  arrangementText,
  type PlacedControl,
  placedControls,
  readArrangement,
  withHidden,
  withPinned,
  withPosition
} from "../toolbarLayout.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { useStored } from "./useStored.ts";

/** The arrangement and what changes it. */
export type ToolbarLayout = {
  /** Every control and where it sits, in the person's order. */
  readonly placed: readonly PlacedControl[];
  /** Whether the person arranged anything: "Reset toolbar" then brings the catalogue's back. */
  readonly isArranged: boolean;
  /** Pins a control on the toolbar or takes it off. */
  readonly pin: (id: string, isPinned: boolean) => void;
  /** Hides a control in the View menu or shows it there again. */
  readonly hide: (id: string, isHidden: boolean) => void;
  /** Moves a control to a position among the shown ones. */
  readonly move: (id: string, index: number) => void;
  /** Forgets the person's arrangement. */
  readonly reset: () => void;
  /** Whether the bar wraps onto more lines when its pinned controls do not fit, instead of moving them into View. */
  readonly isWrapped: boolean;
  /** Turns the wrapping on or off. */
  readonly setIsWrapped: (isWrapped: boolean) => void;
};

/** The person's arrangement of the toolbar. */
export const useToolbarLayout = (): ToolbarLayout => {
  const catalogue = useCatalogue();
  const [arrangement, setArrangement] = useStored("toolbar", readArrangement, arrangementText);
  const [isWrapped, setIsWrapped] = useStored("toolbar-wrap", (stored) => stored === "true", String);
  const placed = placedControls(catalogue, arrangement);
  return {
    placed,
    isArranged: arrangement !== undefined,
    // from the arrangement as it is when the change applies: a drag moves a row several times before a new render
    pin: (id: string, isPinned: boolean): void =>
      setArrangement((current) =>
        arrangementOf(withPinned(placedControls(catalogue, current), id, isPinned))
      ),
    hide: (id: string, isHidden: boolean): void =>
      setArrangement((current) =>
        arrangementOf(withHidden(placedControls(catalogue, current), id, isHidden))
      ),
    move: (id: string, index: number): void =>
      setArrangement((current) => arrangementOf(withPosition(placedControls(catalogue, current), id, index))),
    reset: (): void => setArrangement(undefined),
    isWrapped,
    setIsWrapped
  };
};
