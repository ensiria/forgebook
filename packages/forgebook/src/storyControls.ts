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
import type { ValueSchema } from "./argControl.ts";
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
import { holdsUnsafePart, isFileList, isValueOfShape, resolvedShape } from "./shapeValues.ts";
import { schemaProblem } from "./valueSchema.ts";
import { canSetShape, type ValueShape } from "./valueShape.ts";

/** How a value of a prop is set: the panel's control, or a choice among the source's named values. */
export type ControlKind = Exclude<PanelControl, "none"> | "named" | "custom";

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
  /** A `custom` control's name, of those `argControls` registers. */
  readonly custom?: string;
  /** A `custom` control's `settings`, as the story writes them. */
  readonly settings?: ArgValue;
  /** A `custom` control's schema: what its value must fit. Left out when its module cannot be read. */
  readonly schema?: ValueSchema;
  /** A `token` control's tokens, and what the story receives for one (`forgebook tokens` lists them). */
  readonly tokens?: TokenRequest;
};

/** The custom controls' schemas, by name. */
export type CustomSchemas = Readonly<Record<string, ValueSchema>>;

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
 * @param customSchemas - the custom controls' schemas.
 */
const storyControl = (
  prop: PanelProp,
  namedValues: NamedValues,
  customSchemas: CustomSchemas
): StoryControl => {
  const custom = prop.customControl;
  const schema =
    custom !== undefined && Object.hasOwn(customSchemas, custom) ? customSchemas[custom] : undefined;
  const own =
    prop.control === undefined || prop.control === "none" ? controlOfKind(prop, namedValues) : prop.control;
  const control = custom === undefined ? own : "custom";
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
    ...(prop.tokens === undefined ? {} : { tokens: prop.tokens }),
    ...(custom === undefined ? {} : { custom }),
    ...(prop.settings === undefined ? {} : { settings: prop.settings }),
    ...(schema === undefined ? {} : { schema })
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
  /** The custom controls' schemas, by name, those whose module could be read. */
  readonly customSchemas?: CustomSchemas;
};

/**
 * The props a story's values can set.
 *
 * @param declaration - what the story declares.
 */
export const storyControlsOf = (declaration: StoryDeclaration): readonly StoryControl[] => {
  const argDeclaration: ArgDeclaration = declaration;
  const canSet = (prop: PanelProp): boolean =>
    prop.shape === undefined || canSetShape(prop.shape, declaration.namedValues);
  return declaredArgProps(argDeclaration)
    .filter(canSet)
    .map((prop) => storyControl(prop, declaration.namedValues, declaration.customSchemas ?? {}));
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
    isValueOfShape,
    custom: Object.fromEntries(
      Object.entries(declaration.customSchemas ?? {}).map(([name, schema]) => [
        name,
        (value: ArgValue): string | undefined =>
          holdsUnsafePart(value, true) ? "not what a link may give" : schemaProblem(schema, value)
      ])
    )
  });
  return { accepted, dropped: [...unread, ...notPlain, ...dropped], param: panelArgsParam(accepted) };
};

/** The custom controls as the server read them. */
export type CustomControlsRead = {
  /** The schemas, by control. */
  readonly schemas: CustomSchemas;
  /** Why a control could not be read, by control. */
  readonly problems: Readonly<Record<string, string>>;
};

/**
 * What is wrong with the custom controls a story names: one no configuration registers, or whose module did not load.
 *
 * @param controls - the story's controls.
 * @param read - the custom controls as the server read them.
 */
export const customControlProblems = (
  controls: readonly StoryControl[],
  read: CustomControlsRead | undefined
): readonly string[] =>
  controls.flatMap(({ custom, schema }) => {
    if (custom === undefined || schema !== undefined) return [];
    const problem =
      read !== undefined && Object.hasOwn(read.problems, custom) ? read.problems[custom] : undefined;
    return [
      `The control "${custom}": ${problem ?? "no control is registered under this name in argControls"}`
    ];
  });
