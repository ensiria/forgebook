/**
 * What a story's controls are, for whoever sets its values without the panel: each prop's control and what its value
 * looks like, as an agent reads them, and the values an agent asks to set, checked as a link's are. Pure.
 *
 * @module
 */
import type { StoryControlsSetting } from "@forgebook/story-format/source";

import { type ArgDeclaration, checkedAddressArgs, type DroppedArg, declaredArgProps } from "./addressArgs.ts";
import { readArgsParam } from "./addressArgsParam.ts";
import { type AddressTexts, addressArgsFor } from "./addressTexts.ts";
import {
  isColorProp,
  isNamedProp,
  type PanelArgTypes,
  type PanelControl,
  type PanelProp,
  type TokenRequest
} from "./argTypes.ts";
import type { PropDocs } from "./componentDocs.ts";
import { type ArgValue, type PanelArgs, panelArgsParam } from "./messages.ts";
import type { NamedValues } from "./namedValues.ts";
import { isFileList, isValueOfShape, resolvedShape } from "./shapeValues.ts";
import type { ValueShape } from "./valueShape.ts";

/** How a value of a prop is set: the panel's control, or a choice among the source's named values. */
export type ControlKind = Exclude<PanelControl, "none"> | "named";

/** One prop a story's values can set. */
export type StoryControl = {
  /** The prop's name: the key in `args`. */
  readonly name: string;
  /** Its control, which says what its value is. */
  readonly control: ControlKind;
  /** Its type, as the source writes it. */
  readonly type: string;
  /** Whether the prop must be passed. */
  readonly isRequired: boolean;
  /** What its value looks like, for a value of more than one part. */
  readonly shape?: ValueShape;
  /** A choice's values. */
  readonly choices?: readonly (string | number)[];
  /** A number's lowest value. */
  readonly min?: number;
  /** A number's highest value. */
  readonly max?: number;
  /** The names a `named` control takes, as `{ of: type, named: name }`. */
  readonly named?: readonly string[];
  /** A `token` control's tokens, and what the story receives for one (`forgebook tokens` lists them). */
  readonly tokens?: TokenRequest;
};

/** A prop's control when no `argTypes` names one: from its kind. */
const controlOfKind = (prop: PanelProp, namedValues: NamedValues): ControlKind => {
  if (isNamedProp(prop, namedValues)) return "named";
  if (prop.shape !== undefined) return "object";
  if (prop.kind === "choice") return "select";
  if (prop.kind === "number") return "number";
  if (prop.kind === "toggle") return "boolean";
  return isColorProp(prop) ? "color" : "text";
};

/**
 * One settable prop as an agent reads it.
 *
 * @param prop - the prop.
 * @param namedValues - the source's named values.
 */
const storyControl = (prop: PanelProp, namedValues: NamedValues): StoryControl => {
  const control =
    prop.control === undefined || prop.control === "none" ? controlOfKind(prop, namedValues) : prop.control;
  return {
    name: prop.name,
    control,
    type: prop.type,
    isRequired: prop.isRequired,
    ...(prop.shape === undefined ? {} : { shape: resolvedShape(prop.shape) }),
    ...(prop.choices === undefined ? {} : { choices: prop.choices }),
    ...(prop.min === undefined ? {} : { min: prop.min }),
    ...(prop.max === undefined ? {} : { max: prop.max }),
    ...(control === "named" ? { named: Object.keys(namedValues[prop.type] ?? {}) } : {}),
    ...(prop.tokens === undefined ? {} : { tokens: prop.tokens })
  };
};

/** What a story declares of its args, as the server reads it from the story's module. */
export type StoryDeclaration = {
  /** The props its component's types give. */
  readonly props: readonly PropDocs[];
  /** Its `argTypes`, as the panel reads them. */
  readonly argTypes: PanelArgTypes;
  /** The props the story lets the panel set. */
  readonly controls: StoryControlsSetting;
  /** The story's own args, as the panel reads them. */
  readonly storyArgs: PanelArgs;
  /** The source's named values. */
  readonly namedValues: NamedValues;
};

/**
 * The props a story's values can set.
 *
 * @param declaration - what the story declares.
 */
export const storyControlsOf = (declaration: StoryDeclaration): readonly StoryControl[] => {
  const argDeclaration: ArgDeclaration = declaration;
  return declaredArgProps(argDeclaration).map((prop) => storyControl(prop, declaration.namedValues));
};

/** What became of the values asked for. */
export type SetArgs = {
  /** The values the story takes, by prop; the links carry them. */
  readonly accepted: Readonly<Record<string, ArgValue>>;
  /** The values left out, with the reason. */
  readonly dropped: readonly DroppedArg[];
  /** `args=` as the links write it; empty when none is taken. */
  readonly param: string;
};

/**
 * The values an agent asks to set, checked as a link's are.
 *
 * @param text - the values, as JSON.
 * @param declaration - what the story declares.
 * @param addressTexts - how the framework's stories take a link's texts; `any` by default.
 */
export const checkedSetArgs = (
  text: string,
  declaration: StoryDeclaration,
  addressTexts: AddressTexts = "any"
): SetArgs => {
  const { args, link } = readArgsParam(text.trimStart().startsWith("{") ? text : "{");
  const unread = (link?.unread ?? []).map((name): DroppedArg => ({ name, reason: "unreadable" }));
  const plain = addressArgsFor(args, addressTexts);
  const notPlain = Object.keys(args)
    .filter((name) => !Object.hasOwn(plain, name))
    .map((name): DroppedArg => ({ name, reason: "type" }));
  const { accepted, dropped } = checkedAddressArgs(plain, declaration, undefined, {
    isFileList,
    isValueOfShape
  });
  return { accepted, dropped: [...unread, ...notPlain, ...dropped], param: panelArgsParam(accepted) };
};
