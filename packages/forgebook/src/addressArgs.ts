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
 * source's own entries only, never through an object's prototype (`constructor`). Pure.
 *
 * @module
 */
import type { StoryControlsSetting } from "@forgebook/story-format/source";

import { type PanelArgTypes, type PanelProp, panelProps, settableProps } from "./argTypes.ts";
import type { PropDocs } from "./componentDocs.ts";
import { type ArgValue, isChoiceList, isNamedArg, type PanelArgs } from "./messages.ts";
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

/** Why a value of the address was left out: its name is not one the panel sets, or its value is not of the prop's type. */
export type DroppedArgReason = "undeclared" | "type";

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
};

/** A prop made from one of the story's own args, for an arg neither the types nor the `argTypes` name. */
const propOfStoryArg = (name: string, value: ArgValue): PanelProp | undefined => {
  const prop = { name, type: "", description: "", isRequired: false };
  if (typeof value === "string") return { ...prop, kind: "text" };
  if (typeof value === "number") return { ...prop, kind: "number" };
  if (typeof value === "boolean") return { ...prop, kind: "toggle" };
  // a named value keeps the type it is offered for, so only another value named for it is taken
  if (isNamedArg(value)) return { ...prop, kind: "other", type: value.of };
  // a list's options and a `null`'s type are not known: nothing the address names is taken for them
  return undefined;
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
  return settableProps([...panelProps(props, argTypes), ...ownProps], controls, namedValues);
};

/** Whether a value is a finite number: what a number field sets (an address's JSON has no `NaN` anyway). */
const isFiniteNumber = (value: ArgValue): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Whether a value is one of a choice's options. */
const isOption = (prop: PanelProp, value: ArgValue): boolean =>
  (typeof value === "string" || typeof value === "number") && (prop.choices ?? []).includes(value);

/**
 * Whether a value is one the panel could set for a prop: of the control the `argTypes` name, otherwise of the prop's
 * kind.
 *
 * @param prop - a prop the panel sets.
 * @param value - the address's value.
 * @param namedValues - the source's named values.
 */
export const isValueOfProp = (prop: PanelProp, value: ArgValue, namedValues: NamedValues): boolean => {
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
      if (isNamedArg(value)) {
        return value.of === prop.type && namedValueOf(namedValues, value.of, value.named) !== undefined;
      }
      return prop.canTakeText === true && typeof value === "string";
    case "event":
      return false;
  }
};

/**
 * The address's values the story receives, and those left out with the reason.
 *
 * @param args - the values the address names.
 * @param declaration - what the story declares.
 */
export const checkedAddressArgs = (args: PanelArgs, declaration: ArgDeclaration): CheckedArgs => {
  const declared = declaredArgProps(declaration);
  const accepted: [string, ArgValue][] = [];
  const dropped: DroppedArg[] = [];
  for (const [name, value] of Object.entries(args)) {
    const prop = declared.find((each) => each.name === name);
    if (prop === undefined) dropped.push({ name, reason: "undeclared" });
    else if (!isValueOfProp(prop, value, declaration.namedValues)) dropped.push({ name, reason: "type" });
    else accepted.push([name, value]);
  }
  return { accepted: Object.fromEntries(accepted), dropped };
};
