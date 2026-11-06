/**
 * The worst case the Props tab sets with one button: every prop that takes a text given a long one with a word too
 * long to break in it, every number given a huge one, from the component's docs.
 *
 * @remarks
 * The values are the ones `forgebook new` writes in a story's worst case (`worstCase.ts`). The text joins the long text
 * and the unbreakable word, so one value shows both a box that must wrap and one that must cut or scroll. A colour, a
 * date and a prop whose `argTypes` give it a list keep their values: a long text there is not a case, only an invalid
 * value. A number with a highest value takes that value, the largest the story says it accepts. An object's fields take
 * theirs, a list many items, a mixed union its first member that has a worst case: what the type allows at its fullest.
 *
 * @module
 */
import { isColorProp, type PanelProp } from "../argTypes.ts";
import type { ArgValue, PanelArgs } from "../messages.ts";
import type { NamedValues } from "../namedValues.ts";
import type { ValueShape } from "../valueShape.ts";
import { WORST_ARG_TEXT, WORST_NUMBER } from "../worstCase.ts";

/** Whether a prop is set as a text: of kind text, or a node that takes one, with no other control named. */
const isText = (prop: PanelProp): boolean =>
  (prop.kind === "text" || (prop.kind === "other" && prop.canTakeText === true)) &&
  (prop.control === undefined || prop.control === "text" || prop.control === "textarea") &&
  !isColorProp(prop);

/** Whether a prop is set as a number, with no other control named. */
const isNumber = (prop: PanelProp): boolean =>
  prop.kind === "number" &&
  (prop.control === undefined || prop.control === "number" || prop.control === "range");

/**
 * The worst-case args for the props the panel can set.
 *
 * @param props - the props the panel can set.
 * @param namedValues - the source's named values; none by default.
 * @param worstOfShape - gives a prop with a shape its worst value, once its module loaded; until then they keep theirs.
 * @returns the args, by prop name; empty when no prop takes a text or a number.
 */
export const worstArgs = (
  props: readonly PanelProp[],
  namedValues: NamedValues = {},
  worstOfShape?: (shape: ValueShape, namedValues: NamedValues) => ArgValue | undefined
): PanelArgs =>
  Object.fromEntries(
    props.flatMap((prop): [string, ArgValue][] => {
      if (prop.shape !== undefined && (prop.control === undefined || prop.control === "object")) {
        const worst = worstOfShape?.(prop.shape, namedValues);
        return worst === undefined ? [] : [[prop.name, worst]];
      }
      if (isText(prop)) return [[prop.name, WORST_ARG_TEXT]];
      if (isNumber(prop)) return [[prop.name, prop.max ?? WORST_NUMBER]];
      return [];
    })
  );

/**
 * Whether the values shown are the worst case: every worst-case arg is set to its worst value.
 *
 * @param worst - the worst-case args.
 * @param values - the values shown.
 */
export const isWorstCase = (worst: PanelArgs, values: PanelArgs): boolean => {
  const entries = Object.entries(worst);
  // compared as text: a list or an object comes back from the address as another one that reads the same
  return (
    entries.length > 0 &&
    entries.every(([name, value]) => JSON.stringify(values[name]) === JSON.stringify(value))
  );
};

/** The worst case as the Props tab shows it. */
export type WorstCaseState = {
  /** Whether a prop the panel can set takes a text or a number: the button is shown only then. */
  readonly canApply: boolean;
  /** Whether the values shown are the worst case: the frame then outlines the spills. */
  readonly isOn: boolean;
  /** How many elements spill, as the frame last measured them while the worst case is on; none before. */
  readonly spillCount: number | undefined;
  /** Sets the worst case over the panel's values. */
  readonly onApply: () => void;
};
