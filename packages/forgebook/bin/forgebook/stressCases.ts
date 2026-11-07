/**
 * The cases of a stress run, from a story's props and the catalogue's switches: what `forgebook check --stress` asks the
 * testing package to draw, with no story written.
 *
 * @remarks
 * Pure. Only text a person reads is filled: a prop that names something (an id, a class, an address) is left alone. A text case needs a prop that takes text, a number case one that takes a number: a case with nothing to set is
 * named as not run, never counted as passed. The values are the ones `forgebook new` writes in a story's worst case
 * (`worstCase.ts`), so both test the same edges. Right to left uses the catalogue's direction switch when it has one,
 * with text in a right-to-left script; dark and contrast use its scheme and contrast switches, and are not run without them.
 *
 * @module
 */
import type { StressCaseRequest } from "../../src/storyCheck.ts";
import type { StoryControl } from "../../src/storyControls.ts";
import { switchWithRole, type ViewSwitch } from "../../src/switches.ts";
import { WORST_NUMBER, WORST_TEXT, WORST_WORD } from "../../src/worstCase.ts";

/** Text in a right-to-left script, with a number and a Latin word in it, as real content mixes them. */
export const RTL_TEXT = "مرحبا بالعالم، هذا نص طويل بعض الشيء 12345 Forgebook";

/** The window's width a 200 % zoom lays a page out in, from the default window's 1,280 px. */
const ZOOMED_WIDTH = 640;

/** A phone held upright, narrower than any variant the catalogue's tests check. */
const NARROW_WIDTH = 320;

/**
 * A text prop that names something rather than shows it (an id, a reference to one, a class, a form field's name, an
 * address), or a slot for a picture (an icon, an avatar). A long text there is no case, only an invalid value, and checks
 * would find the value, not the component: text in an icon's slot draws over the label beside it.
 */
const NAMES_SOMETHING =
  /^(?:icon|avatar|image|img|logo|id|key|name|form|qa|role|lang|dir|slot|as|type|target|rel|href|src|htmlFor|for|tabIndex|autoComplete|inputMode|pattern|accept|class|className|testId)$|(?:ClassName|Class|Id|Ids|Url|Href|Src|Ref|Key|Icon|Avatar|Image|Logo)$|^aria-(?:labelledby|describedby|details|controls|owns|activedescendant|errormessage|flowto)$|^data-/;

/**
 * What axe finds when a control is given no text: an empty label is the case's doing, so a finding of these in `empty`
 * would blame the component for the value it was given.
 */
const NAME_RULES: readonly string[] = [
  "button-name",
  "link-name",
  "label",
  "select-name",
  "input-button-name",
  "aria-input-field-name",
  "empty-heading"
];

/** The cases a run asks for, and those it could not. */
export type StressPlan = {
  /** The cases to draw. */
  readonly cases: readonly StressCaseRequest[];
  /** The cases not run, and why. */
  readonly skipped: readonly string[];
};

/** The view that sets a switch of a role to the first value matching, when the catalogue has one. */
const switchView = (
  switches: readonly ViewSwitch[],
  role: "colorScheme" | "contrast" | "direction",
  isWanted: (value: ViewSwitch["values"][number]) => boolean
): string | undefined => {
  const found = switchWithRole(switches, role);
  const value = found?.values.find(isWanted);
  return found === undefined || value === undefined
    ? undefined
    : `${found.id}=${encodeURIComponent(value.value)}`;
};

/** The values that give every prop of a list one value. */
const allOf = (props: readonly StoryControl[], value: unknown): Readonly<Record<string, unknown>> =>
  Object.fromEntries(props.map((prop) => [prop.name, value]));

/**
 * The cases for one story.
 *
 * @param controls - the props its values can set, as `forgebook story` lists them.
 * @param switches - the catalogue's switches.
 */
export const stressPlan = (
  controls: readonly StoryControl[],
  switches: readonly ViewSwitch[]
): StressPlan => {
  const texts = controls.filter(
    (each) => (each.control === "text" || each.control === "textarea") && !NAMES_SOMETHING.test(each.name)
  );
  const numbers = controls.filter((each) => each.control === "number" || each.control === "range");
  const huge = Object.fromEntries(numbers.map((prop) => [prop.name, prop.max ?? WORST_NUMBER]));
  const dark = switchView(switches, "colorScheme", (value) => value.scheme === "dark");
  const more = switchView(switches, "contrast", (value) => value.isMore === true);
  const rtl = switchView(switches, "direction", (value) => value.value === "rtl");
  const noText = "no prop takes text";
  const cases: (StressCaseRequest | string)[] = [
    texts.length === 0
      ? `long-text: ${noText}`
      : { name: "long-text", args: allOf(texts, WORST_TEXT), view: "" },
    texts.length === 0
      ? `unbreakable: ${noText}`
      : { name: "unbreakable", args: allOf(texts, WORST_WORD), view: "" },
    texts.length === 0
      ? `empty: ${noText}`
      : { name: "empty", args: allOf(texts, ""), view: "", expectedRules: NAME_RULES },
    numbers.length === 0
      ? "huge-number: no prop takes a number"
      : { name: "huge-number", args: huge, view: "" },
    rtl === undefined
      ? { name: "rtl", args: allOf(texts, RTL_TEXT), view: "", isRtl: true }
      : { name: "rtl", args: allOf(texts, RTL_TEXT), view: rtl },
    { name: "zoom-200", args: {}, view: "", width: ZOOMED_WIDTH },
    { name: "narrow", args: allOf(texts, WORST_TEXT), view: "", width: NARROW_WIDTH },
    dark === undefined ? "dark: the catalogue has no dark scheme" : { name: "dark", args: {}, view: dark },
    more === undefined
      ? "contrast: the catalogue has no more-contrast value"
      : { name: "contrast", args: {}, view: more }
  ];
  return {
    cases: cases.filter((each): each is StressCaseRequest => typeof each !== "string"),
    skipped: cases.filter((each): each is string => typeof each === "string")
  };
};
