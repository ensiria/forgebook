/**
 * The props panel's values an address names (`?args=`), checked against what the story declares before any reaches
 * its frame.
 *
 * @remarks
 * A link shares a view, so whoever writes the link chooses these values, and the frame runs on the catalogue's own
 * origin. Handed on unchecked, a name the story never declared reaches the component, which may pass it to an element
 * as an attribute: `innerHTML` or `onclick` on Vue's fallthrough attributes, `srcDoc` on a React element that spreads
 * its rest props; each runs a script with the catalogue's rights. So a value is kept only when the panel itself could
 * have set it: a prop the panel lets the person set (the component's props with the story's `argTypes` laid over them,
 * or an arg only the `argTypes` or the story's own args name), with a value of that prop's type. Everything else is
 * left out and reported. A value that is code never comes from an address: a named value is looked up among the
 * source's own entries only, never through an object's prototype (`constructor`). An object's names are checked the
 * same way, against its type (`valueShape.ts`). The panel's "no value" (`UnsetArg`) passes for any prop the panel sets:
 * the story receives `undefined`, which any prop may. Pure.
 *
 * A frame takes values from one kind of message only, whichever frame it is (the stage's, an embed's, a plugin's aside),
 * so `checkedArgsMessage` builds it, from nothing but what this check sealed (`AcceptedArgs`): a page that skipped the
 * check has no value of that type to give it. A test holds every other module to not writing the message itself.
 *
 * @module
 */
import type { StoryControlsSetting } from "@forgebook/story-format/source";

import { type PanelArgTypes, type PanelProp, panelProps, settableProps } from "./argTypes.ts";
import type { PropDocs } from "./componentDocs.ts";
import {
  type ArgValue,
  isChoiceList,
  isNamedArg,
  isUnsetArg,
  type PanelArgs,
  type ShellMessage
} from "./messages.ts";
import { type NamedValues, namedValueOf } from "./namedValues.ts";

/** What a story declares about the args the panel sets, as the shell knows it once the story's frame is ready. */
export type ArgDeclaration = {
  /** The props the component's types give; none when the story has no component or its docs could not be read. */
  readonly props: readonly PropDocs[];
  /** The story's `argTypes`, as its frame reported them. */
  readonly argTypes: PanelArgTypes;
  /** The props the story lets the panel set. */
  readonly controls: StoryControlsSetting;
  /** The story's own args the panel can show, as its frame reported them. */
  readonly storyArgs: PanelArgs;
  /** The values the source names for types the panel cannot write. */
  readonly namedValues: NamedValues;
};

/**
 * Why a value of the address was left out: its name is not one the panel sets, its value is not of the prop's type, its
 * text could not be read as a value at all, or its custom control refuses it or cannot load.
 */
export type DroppedArgReason = "undeclared" | "type" | "unreadable" | "control" | "markup";

/** A value of the address left out. */
export type DroppedArg = {
  /** The arg's name, as the address wrote it. */
  readonly name: string;
  /** Why it was left out. */
  readonly reason: DroppedArgReason;
};

/** The address's values once checked. */
export type CheckedArgs = {
  /** The values the story receives. */
  readonly accepted: PanelArgs;
  /** The values left out, in the address's order. */
  readonly dropped: readonly DroppedArg[];
  /** Whether a value waits for what checks it: it is neither taken nor left out yet. */
  readonly isWaiting: boolean;
  /** The values the story receives, as a frame can be told them. */
  readonly sealed: AcceptedArgs;
};

/** What only this module can write on values: the type system's proof that they went through the check. */
const ACCEPTED: unique symbol = Symbol("accepted");

/** Values the check accepted, the only ones a frame can be told. */
export type AcceptedArgs = {
  /** The values. */
  readonly values: PanelArgs;
  /** Marks them as the check's. */
  readonly [ACCEPTED]: true;
};

/** No values: what a frame the address has no say in receives (a story on a docs page). */
export const NO_ACCEPTED_ARGS: AcceptedArgs = { values: {}, [ACCEPTED]: true };

/** A prop made from one of the story's own args, for an arg neither the types nor the `argTypes` name. */
const propOfStoryArg = (name: string, value: ArgValue): PanelProp | undefined => {
  const prop = { name, type: "", description: "", isRequired: false };
  if (typeof value === "string") return { ...prop, kind: "text" };
  if (typeof value === "number") return { ...prop, kind: "number" };
  if (typeof value === "boolean") return { ...prop, kind: "toggle" };
  // a named value keeps the type it is offered for, so only another value named for it is taken
  if (isNamedArg(value)) return { ...prop, kind: "other", type: value.of };
  // a `null`'s type is not known: nothing the address names is taken for it
  if (value === null) return undefined;
  return { ...prop, kind: "other", shape: { kind: "like", value } };
};

/**
 * The props the panel sets for a story, whatever the address says: the component's props with the `argTypes` over
 * them and the args only the `argTypes` name, then the story's own args the two leave out, each kept only when the
 * story's controls let the panel set it.
 *
 * @param declaration - what the story declares.
 */
export const declaredArgProps = (declaration: ArgDeclaration): readonly PanelProp[] => {
  const { props, argTypes, controls, storyArgs, namedValues } = declaration;
  const named = new Set([...props.map((prop) => prop.name), ...Object.keys(argTypes)]);
  const ownProps = Object.entries(storyArgs).flatMap(([name, value]): PanelProp[] => {
    if (named.has(name)) return [];
    const prop = propOfStoryArg(name, value);
    return prop === undefined ? [] : [prop];
  });
  return settableProps([...panelProps(props, argTypes, storyArgs), ...ownProps], controls, namedValues);
};

/** Whether a value is a finite number: what a number field sets (an address's JSON has no `NaN` anyway). */
const isFiniteNumber = (value: ArgValue): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Whether a value is one of a choice's options. */
const isOption = (prop: PanelProp, value: ArgValue): boolean =>
  (typeof value === "string" || typeof value === "number") && (prop.choices ?? []).includes(value);

/** What checks a custom control's value, by control: gives what is wrong with it. A control missing here refuses all. */
export type CustomChecks = Readonly<Record<string, (value: ArgValue) => string | undefined>>;

/** What checks a structured value: `shapeValues.ts` and each control's schema, loaded with the first prop that needs them. */
export type ArgChecks = Pick<typeof import("./shapeValues.ts"), "isValueOfShape" | "isFileList"> & {
  /** What checks a custom control's value; none refuses them all. */
  readonly custom?: CustomChecks;
};

/**
 * Whether a prop's values are checked by `shapeValues.ts`.
 *
 * @param prop - a prop the panel sets.
 */
export const needsShapeChecks = (prop: PanelProp): boolean =>
  prop.customControl !== undefined ||
  prop.control === "file" ||
  prop.control === "object" ||
  (prop.control === undefined && prop.kind === "other" && prop.shape !== undefined);

/**
 * Whether a value is one the panel could set for a prop: of the control the `argTypes` name, otherwise of the prop's
 * kind.
 *
 * @param prop - a prop the panel sets.
 * @param value - the address's value.
 * @param namedValues - the source's named values.
 * @param shapes - what checks a value against a shape; none refuses a prop that needs it.
 */
export const isValueOfProp = (
  prop: PanelProp,
  value: ArgValue,
  namedValues: NamedValues,
  shapes?: ArgChecks
): boolean => {
  switch (prop.control) {
    case "select":
    case "radio":
      return isOption(prop, value);
    case "check":
    case "multi-select":
      return isChoiceList(value) && value.every((item) => isOption(prop, item));
    case "boolean":
      return typeof value === "boolean";
    case "text":
    case "color":
      return typeof value === "string";
    case "number":
    case "range":
    case "date":
      return isFiniteNumber(value);
    case "textarea":
    case "token":
      return typeof value === "string";
    case "object":
      return prop.shape !== undefined && shapes?.isValueOfShape(prop.shape, value, namedValues) === true;
    case "file":
      return shapes?.isFileList(value) === true;
    case "none":
      return false;
    case undefined:
      break;
  }
  switch (prop.kind) {
    case "choice":
      return isOption(prop, value);
    case "text":
      return typeof value === "string";
    case "number":
      return isFiniteNumber(value);
    case "toggle":
      return typeof value === "boolean";
    case "other":
      if (
        isNamedArg(value) &&
        value.of === prop.type &&
        namedValueOf(namedValues, value.of, value.named) !== undefined
      )
        return true;
      if (prop.shape !== undefined && shapes?.isValueOfShape(prop.shape, value, namedValues) === true)
        return true;
      return prop.canTakeText === true && typeof value === "string";
    case "event":
      return false;
  }
};

/** Whether a custom control takes a value: it loaded, and its check finds nothing wrong. */
const fitsControl = (custom: CustomChecks, control: string, value: ArgValue): boolean =>
  Object.hasOwn(custom, control) && custom[control]?.(value) === undefined;

/** What the check reads besides the value. */
type CheckReach = {
  readonly namedValues: NamedValues;
  readonly checks: ArgChecks | undefined;
};

/** What becomes of a value for a prop the panel sets: the story takes it, it waits for its check, or why it is left out. */
const verdictOf = (
  prop: PanelProp,
  value: ArgValue,
  { namedValues, checks }: CheckReach
): "taken" | "waiting" | DroppedArgReason => {
  if (isUnsetArg(value)) return "taken";
  if (checks === undefined && needsShapeChecks(prop)) return "waiting";
  if (prop.customControl !== undefined)
    return fitsControl(checks?.custom ?? {}, prop.customControl, value) ? "taken" : "control";
  return isValueOfProp(prop, value, namedValues, checks) ? "taken" : "type";
};

/**
 * The address's values the story receives, and those left out with the reason.
 *
 * @param args - the values the address names.
 * @param declaration - what the story declares.
 * @param typeValue - types a value for its prop, for a link whose form does not say (`storybookArgs.ts`); none takes each
 *   as written.
 * @param checks - what checks a structured value, a custom control's among them; none leaves such a value waiting.
 */
export const checkedAddressArgs = (
  args: PanelArgs,
  declaration: ArgDeclaration,
  typeValue?: (prop: PanelProp, value: ArgValue) => ArgValue,
  checks?: ArgChecks
): CheckedArgs => {
  const declared = declaredArgProps(declaration);
  const accepted: [string, ArgValue][] = [];
  const dropped: DroppedArg[] = [];
  let isWaiting = false;
  for (const [name, written] of Object.entries(args)) {
    const prop = declared.find((each) => each.name === name);
    const value = prop !== undefined && typeValue !== undefined ? typeValue(prop, written) : written;
    const verdict =
      prop === undefined
        ? "undeclared"
        : verdictOf(prop, value, { namedValues: declaration.namedValues, checks });
    if (verdict === "taken") accepted.push([name, value]);
    else if (verdict === "waiting") isWaiting = true;
    else dropped.push({ name, reason: verdict });
  }
  const values: PanelArgs = Object.fromEntries(accepted);
  return { accepted: values, dropped, isWaiting, sealed: { values, [ACCEPTED]: true } };
};

/**
 * The message that gives a frame its values.
 *
 * @param accepted - the values `checkedAddressArgs` accepted.
 */
export const checkedArgsMessage = (accepted: AcceptedArgs): ShellMessage => ({
  type: "forgebook:args",
  args: accepted.values
});
