/**
 * The worst case the Props tab sets with one button: every prop that takes a text given a long one with a word too
 * long to break in it, every number given a huge one, from the component's docs.
 *
 * @remarks
 * The values are the ones `forgebook new` writes in a story's worst case (`worstCase.ts`). The text joins the long text
 * and the unbreakable word, so one value shows both a box that must wrap and one that must cut or scroll. A colour, a
 * date and a prop whose `argTypes` give it a list keep their values: a long text there is not a case, only an invalid
 * value. A number with a highest value takes that value, the largest the story says it accepts.
 *
 * @module
 */
import { isColorProp, type PanelProp } from "../argTypes.ts";
import type { PanelArgs } from "../messages.ts";
import { WORST_NUMBER, WORST_TEXT, WORST_WORD } from "../worstCase.ts";

/** The worst text: a long one, with a word that cannot break. */
export const WORST_ARG_TEXT = `${WORST_TEXT} ${WORST_WORD}`;

/** Whether a prop is set as a text: of kind text, or a node that takes one, with no other control named. */
const isText = (prop: PanelProp): boolean =>
  (prop.kind === "text" || (prop.kind === "other" && prop.canTakeText === true)) &&
  (prop.control === undefined || prop.control === "text") &&
  !isColorProp(prop);

/** Whether a prop is set as a number, with no other control named. */
const isNumber = (prop: PanelProp): boolean =>
  prop.kind === "number" &&
  (prop.control === undefined || prop.control === "number" || prop.control === "range");

/**
 * The worst-case args for the props the panel can set.
 *
 * @param props - the props the panel can set.
 * @returns the args, by prop name; empty when no prop takes a text or a number.
 */
export const worstArgs = (props: readonly PanelProp[]): PanelArgs =>
  Object.fromEntries(
    props.flatMap((prop): [string, string | number][] => {
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
  return entries.length > 0 && entries.every(([name, value]) => values[name] === value);
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
