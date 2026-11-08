/**
 * A story's `argTypes` (Storybook's) as the shell reads them: in the form that crosses between the documents, laid over the
 * props the component's types give. What reads them from the story's module is `storyArgTypes.ts`.
 *
 * @remarks
 * The panel's props come from the component's types (`componentDocs.ts`); `argTypes` say otherwise where a story
 * means another control, other options, other names, or an arg the types do not name. Without `argTypes` the panel
 * shows the props exactly as the types give them. Option values that cannot cross (a component, a function) are
 * sent as their `mapping` keys, which the frame turns back into the values. An `object` control edits the prop by the
 * shape its type gives (`valueShape.ts`), by what the story's own arg looks like without one, as JSON when nothing says.
 * Pure.
 *
 * @module
 */

import type { StoryControlsSetting } from "@forgebook/story-format/source";

import { type ArgCondition, isArgCondition } from "./argConditions.ts";
import type { PropDocs } from "./componentDocs.ts";
import type { ArgValue } from "./messages.ts";
import type { NamedValues } from "./namedValues.ts";
import type { ValueShape } from "./valueShape.ts";

/** A control as the panel draws it; `none` for an arg the panel lists without a control. */
export type PanelControl =
  | "select"
  | "radio"
  | "check"
  | "multi-select"
  | "boolean"
  | "text"
  | "number"
  | "range"
  | "color"
  | "date"
  | "object"
  | "textarea"
  | "token"
  | "file"
  | "none";

/** Which of the catalogue's design tokens a `token` control offers, and what the story receives for one. */
export type TokenRequest = {
  /** A token's type (`color`, `dimension`) or a part of its name (`space`, `radius`): what it offers. */
  readonly of: string;
  /**
   * What the story receives, with `{name}` for the token's name in CSS's form and `{value}` for its value
   * (`var(--{name})`); its value by default.
   */
  readonly format?: string;
};

/** How the panel shows one arg, from its `argTypes` entry: what crosses from the frame to the shell. */
export type PanelArgType = {
  /** The name the panel shows, when it is not the arg's. */
  readonly label?: string;
  /** What the arg does, over its TSDoc. */
  readonly description?: string;
  /** Whether the panel leaves the arg out. */
  readonly isHidden: boolean;
  /** Its control, when the entry names one (or gives options, which make a choice). */
  readonly control?: PanelControl;
  /** A choice's options: texts and numbers, or the `mapping` keys the story receives values for. */
  readonly options?: readonly (string | number)[];
  /** The names shown for the options, by option. */
  readonly labels?: Readonly<Record<string, string>>;
  /** A range's or a number's lowest value. */
  readonly min?: number;
  /** A range's or a number's highest value. */
  readonly max?: number;
  /** A range's or a number's step. */
  readonly step?: number;
  /** When the panel shows the arg (`if`); none always. */
  readonly if?: ArgCondition;
  /** A `token` control's tokens. */
  readonly tokens?: TokenRequest;
  /** The files a `file` control takes, as `<input accept>` writes it. */
  readonly accept?: string;
  /** The custom control it names, of those `argControls` registers: any name that is none of the panel's. */
  readonly customControl?: string;
  /** The custom control's `settings`. */
  readonly settings?: ArgValue;
};

/** The panel's arg types, by arg. */
export type PanelArgTypes = Readonly<Record<string, PanelArgType>>;

/** A prop as the panel shows it: its docs with what `argTypes` say laid over them. */
export type PanelProp = PropDocs & {
  /** The name the panel shows, when it is not the prop's. */
  readonly label?: string;
  /** The control `argTypes` name; none leaves it to the prop's kind. */
  readonly control?: PanelControl;
  /** The names shown for a choice's values, by value. */
  readonly labels?: Readonly<Record<string, string>>;
  /** A range's or a number's lowest value. */
  readonly min?: number;
  /** A range's or a number's highest value. */
  readonly max?: number;
  /** A range's or a number's step. */
  readonly step?: number;
  /** A `token` control's tokens. */
  readonly tokens?: TokenRequest;
  /** The files a `file` control takes. */
  readonly accept?: string;
  /** The custom control it names. */
  readonly customControl?: string;
  /** The custom control's `settings`. */
  readonly settings?: ArgValue;
};

/**
 * Whether a prop is a colour: named so by its `argTypes`, or by the name convention (`color`, `accentColor`).
 *
 * @param prop - the prop.
 */
export const isColorProp = (prop: PanelProp): boolean =>
  prop.control === "color" ||
  (prop.control === undefined &&
    prop.kind === "text" &&
    (prop.name === "color" || prop.name.endsWith("Color")));

/**
 * Whether a prop is chosen among the values the source names for its type (`IconComponent`).
 *
 * @param prop - the prop.
 * @param namedValues - the source's named values.
 */
export const isNamedProp = (prop: PanelProp, namedValues: NamedValues): boolean =>
  prop.kind === "other" && prop.control === undefined && namedValues[prop.type] !== undefined;

/**
 * The props the panel can set: a prop of a type the source names values for is chosen among them, a node that takes a
 * text is set as one, a prop with a shape by its fields; any other `other` prop, and an event, cannot be set; nor a prop
 * the story's controls leave out.
 *
 * @param props - the component's props, with the story's `argTypes` laid over them.
 * @param controls - the props the story lets the panel set.
 * @param namedValues - the source's named values.
 */
export const settableProps = (
  props: readonly PanelProp[],
  controls: StoryControlsSetting,
  namedValues: NamedValues
): PanelProp[] =>
  props.filter(
    (prop) =>
      (prop.kind !== "other" ||
        prop.canTakeText === true ||
        prop.control === "file" ||
        prop.customControl !== undefined ||
        isNamedProp(prop, namedValues) ||
        prop.shape !== undefined) &&
      prop.kind !== "event" &&
      (controls === "all" || controls.includes(prop.name))
  );

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The prop kind a control sets, for the panel's groups. */
const KIND_OF_CONTROL: Readonly<Record<PanelControl, PropDocs["kind"]>> = {
  select: "choice",
  radio: "choice",
  check: "choice",
  "multi-select": "choice",
  boolean: "toggle",
  text: "text",
  number: "number",
  range: "number",
  color: "text",
  date: "number",
  object: "other",
  textarea: "text",
  token: "text",
  file: "other",
  none: "other"
};

/**
 * What a prop's editor reads of its arg type: an `object` control's shape, from its type, else from the story's own value,
 * else JSON; a `token` control's tokens; what a `file` control takes.
 */
const editorFieldsOf = (
  prop: PropDocs,
  argType: PanelArgType,
  own: ArgValue | undefined
): Partial<Pick<PanelProp, "kind" | "shape" | "tokens" | "accept" | "customControl" | "settings">> => {
  const shapeOfOwn: ValueShape =
    own === undefined || own === null ? { kind: "json" } : { kind: "like", value: own };
  return {
    ...(argType.control === "object" ? { shape: prop.shape ?? shapeOfOwn } : {}),
    // a `token` control that names no tokens asks for those named after its arg
    ...(argType.control === "token" ? { tokens: argType.tokens ?? { of: prop.name } } : {}),
    ...(argType.accept === undefined ? {} : { accept: argType.accept }),
    ...(argType.customControl === undefined
      ? {}
      : {
          kind: "other",
          customControl: argType.customControl,
          ...(argType.settings === undefined ? {} : { settings: argType.settings })
        })
  };
};

/**
 * A prop with its arg type laid over it.
 *
 * @param prop - the prop as the types give it.
 * @param argType - its arg type.
 * @param own - the story's own value of the arg: what an `object` control with no type to read draws its fields from.
 */
const withArgType = (prop: PropDocs, argType: PanelArgType, own: ArgValue | undefined): PanelProp => {
  const { control } = argType;
  // a control the panel cannot draw makes the prop one it lists for reading, never one that takes a text
  const isReadOnly = control === "none";
  const { canTakeText: _canTakeText, ...rest } = prop;
  // a control the story names decides what its value is: the type's shape no longer draws nor checks it
  const { shape: _shape, ...shapeless } = isReadOnly || argType.customControl !== undefined ? rest : prop;
  return {
    ...(control === undefined && argType.customControl === undefined ? prop : shapeless),
    ...(control === undefined ? {} : { kind: KIND_OF_CONTROL[control], control }),
    ...(argType.options === undefined ? {} : { choices: argType.options }),
    ...(argType.description === undefined ? {} : { description: argType.description }),
    ...(argType.label === undefined ? {} : { label: argType.label }),
    ...(argType.labels === undefined ? {} : { labels: argType.labels }),
    ...(argType.min === undefined ? {} : { min: argType.min }),
    ...(argType.max === undefined ? {} : { max: argType.max }),
    ...(argType.step === undefined ? {} : { step: argType.step }),
    ...editorFieldsOf(prop, argType, own)
  };
};

/** A prop the types do not name, made from its arg type alone: a text when it names no control. */
const propOfArgType = (name: string, argType: PanelArgType, own: ArgValue | undefined): PanelProp =>
  withArgType({ name, kind: "text", type: "", description: "", isRequired: false }, argType, own);

/** A prop as its TSDoc asks: chosen among the tokens `@token` names, when it is set as a text. */
const propAsDocumented = (prop: PropDocs): PanelProp =>
  prop.token !== undefined && (prop.kind === "text" || prop.canTakeText === true)
    ? { ...prop, kind: "text", control: "token", tokens: { of: prop.token } }
    : prop;

/**
 * The panel's props: the component's, with their arg types laid over them, the hidden ones left out, then the args
 * only the arg types name, in their order.
 *
 * @param props - the props the component's types give.
 * @param argTypes - the story's arg types; none leaves the props as they are.
 * @param storyArgs - the story's own args, for an `object` control no type describes; none by default.
 */
export const panelProps = (
  props: readonly PropDocs[],
  argTypes: PanelArgTypes,
  storyArgs: Readonly<Record<string, ArgValue>> = {}
): readonly PanelProp[] => {
  const typed = new Set(props.map((prop) => prop.name));
  const fromTypes = props.flatMap((prop): PanelProp[] => {
    const argType = argTypes[prop.name];
    if (argType === undefined) return [propAsDocumented(prop)];
    if (argType.isHidden) return [];
    return [
      withArgType(
        argType.control === undefined ? propAsDocumented(prop) : prop,
        argType,
        storyArgs[prop.name]
      )
    ];
  });
  const fromArgTypes = Object.entries(argTypes).flatMap(([name, argType]): PanelProp[] =>
    typed.has(name) || argType.isHidden ? [] : [propOfArgType(name, argType, storyArgs[name])]
  );
  return [...fromTypes, ...fromArgTypes];
};

/** Whether a value is one arg's panel arg type. */
const isPanelArgType = (value: unknown): value is PanelArgType =>
  isRecord(value) &&
  typeof value["isHidden"] === "boolean" &&
  (value["if"] === undefined || isArgCondition(value["if"])) &&
  (value["control"] === undefined ||
    (typeof value["control"] === "string" && Object.hasOwn(KIND_OF_CONTROL, value["control"]))) &&
  (value["tokens"] === undefined ||
    (isRecord(value["tokens"]) && typeof value["tokens"]["of"] === "string")) &&
  (value["accept"] === undefined || typeof value["accept"] === "string") &&
  (value["customControl"] === undefined || typeof value["customControl"] === "string") &&
  (value["options"] === undefined ||
    (Array.isArray(value["options"]) &&
      value["options"].every((option) => typeof option === "string" || typeof option === "number")));

/**
 * Whether a value received from a frame is a story's panel arg types.
 *
 * @param value - the message's field.
 */
export const isPanelArgTypes = (value: unknown): value is PanelArgTypes =>
  isRecord(value) && Object.values(value).every(isPanelArgType);
