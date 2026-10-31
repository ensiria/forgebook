/**
 * The person's arrangement of the toolbar, kept in their browser per catalogue: where each control sits, in what
 * order, whether a full bar wraps, the keys they gave the controls, and the changes the View menu and the toolbar's
 * controls make to it.
 *
 * @module
 */

import { type ControlKeys, type ReaderKeys, shownKeys, withReaderKey } from "../controlKeys.ts";
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
  /** Forgets the person's arrangement and their keys. */
  readonly reset: () => void;
  /** Whether the bar wraps onto more lines when its pinned controls do not fit, instead of moving them into View. */
  readonly isWrapped: boolean;
  /** Turns the wrapping on or off. */
  readonly setIsWrapped: (isWrapped: boolean) => void;
  /** The keys that cycle the controls: the catalogue's, with the person's own over them. */
  readonly keys: ControlKeys;
  /**
   * Gives a control another key, or takes its key away (`null`).
   *
   * @returns why the key cannot be given; none when it was.
   */
  readonly setKey: (id: string, key: string | null) => string | undefined;
};

/** The person's keys a stored text holds; none for anything else. */
const readKeys = (stored: string | null): ReaderKeys => {
  if (stored === null || stored === "") return {};
  try {
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string | null] => typeof entry[1] === "string" || entry[1] === null
      )
    );
  } catch {
    return {};
  }
};

/** The text the person's keys are stored as; empty for none. */
const keysText = (keys: ReaderKeys): string => (Object.keys(keys).length === 0 ? "" : JSON.stringify(keys));

/** The person's arrangement of the toolbar. */
export const useToolbarLayout = (): ToolbarLayout => {
  const catalogue = useCatalogue();
  const [arrangement, setArrangement] = useStored("toolbar", readArrangement, arrangementText);
  const [isWrapped, setIsWrapped] = useStored("toolbar-wrap", (stored) => stored === "true", String);
  const [readerKeys, setReaderKeys] = useStored("toolbar-keys", readKeys, keysText);
  const placed = placedControls(catalogue, arrangement);
  return {
    placed,
    isArranged: arrangement !== undefined || Object.keys(readerKeys).length > 0,
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
    reset: (): void => {
      setArrangement(undefined);
      setReaderKeys({});
    },
    isWrapped,
    setIsWrapped,
    keys: shownKeys(catalogue.keys, readerKeys),
    setKey: (id: string, key: string | null): string | undefined => {
      const changed = withReaderKey(catalogue.keys, readerKeys, id, key);
      if (typeof changed === "string") return changed;
      setReaderKeys(changed);
      return undefined;
    }
  };
};
