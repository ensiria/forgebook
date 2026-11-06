/**
 * A story's `argTypes` (Storybook's): read in the frame from the meta and the story, sent to the shell in a form that
 * crosses between the documents, laid over the props the component's types give, and their `mapping` applied to the
 * args the story receives.
 *
 * @remarks
 * The panel's props come from the component's types (`componentDocs.ts`); `argTypes` say otherwise where a story
 * means another control, other options, other names, or an arg the types do not name. Without `argTypes` the panel
 * shows the props exactly as the types give them. Option values that cannot cross (a component, a function) are
 * sent as their `mapping` keys, which the frame turns back into the values. `object` and `file` controls have no
 * control in the panel: their args are listed for reading. Pure.
 *
 * @module
 */

import type { StoryControlsSetting } from "@forgebook/story-format/source";

import { type ArgCondition, argConditionOf, isArgCondition } from "./argConditions.ts";
import type { PropDocs } from "./componentDocs.ts";
import type { NamedValues } from "./namedValues.ts";

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
  | "none";

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
 * text is set as one; any other `other` prop, and an event, cannot be set; nor a prop the story's controls leave out.
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
      (prop.kind !== "other" || prop.canTakeText === true || isNamedProp(prop, namedValues)) &&
      prop.kind !== "event" &&
      (controls === "all" || controls.includes(prop.name))
  );

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Storybook's control names, as the panel draws them (the inline variants look the same here). */
const CONTROLS: Readonly<Record<string, PanelControl>> = {
  select: "select",
  radio: "radio",
  "inline-radio": "radio",
  check: "check",
  "inline-check": "check",
  "multi-select": "multi-select",
  boolean: "boolean",
  text: "text",
  number: "number",
  range: "range",
  color: "color",
  date: "date",
  object: "none",
  file: "none"
};

/** The panel controls, for the check on arrival. */
const PANEL_CONTROLS: readonly PanelControl[] = [...new Set(Object.values(CONTROLS))];

/** A number field of an object, when it is a finite number. */
const numberOf = (part: Readonly<Record<string, unknown>>, name: string): number | undefined => {
  const value = part[name];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

/** The labels of a control, when every one is a text. */
const labelsOf = (value: unknown): Readonly<Record<string, string>> | undefined =>
  isRecord(value) && Object.values(value).every((label) => typeof label === "string")
    ? Object.fromEntries(Object.entries(value).map(([option, label]) => [option, String(label)]))
    : undefined;

/**
 * The control an entry names: `false` and a disabled control are none, a name or `{ type }` is that control, and
 * options without a control make a select.
 */
const controlOf = (entry: Readonly<Record<string, unknown>>): PanelControl | undefined => {
  const control = entry["control"];
  if (control === false) return "none";
  if (typeof control === "string") return CONTROLS[control];
  if (isRecord(control)) {
    if (control["disable"] === true) return "none";
    if (typeof control["type"] === "string") return CONTROLS[control["type"]];
  }
  return Array.isArray(entry["options"]) ? "select" : undefined;
};

/**
 * The options as they cross: texts and numbers as they are; any other value only through `mapping`, whose keys are
 * the options then.
 */
const optionsOf = (entry: Readonly<Record<string, unknown>>): readonly (string | number)[] | undefined => {
  const options = entry["options"];
  if (!Array.isArray(options)) return undefined;
  return options.filter(
    (option): option is string | number => typeof option === "string" || typeof option === "number"
  );
};

/**
 * One entry as the panel reads it.
 *
 * @param entry - the `argTypes` entry, the story's laid over the meta's.
 * @param isExcluded - whether `parameters.controls.exclude` names the arg.
 */
const panelArgTypeOf = (entry: Readonly<Record<string, unknown>>, isExcluded: boolean): PanelArgType => {
  const control = controlOf(entry);
  const options = optionsOf(entry);
  const settings = isRecord(entry["control"]) ? entry["control"] : {};
  const table = entry["table"];
  const name = entry["name"];
  const description = entry["description"];
  const labels = labelsOf(settings["labels"]);
  const min = numberOf(settings, "min");
  const max = numberOf(settings, "max");
  const step = numberOf(settings, "step");
  const condition = argConditionOf(entry["if"]);
  return {
    isHidden: isExcluded || (isRecord(table) && table["disable"] === true),
    ...(typeof name === "string" ? { label: name } : {}),
    ...(typeof description === "string" ? { description } : {}),
    ...(control === undefined ? {} : { control }),
    ...(options === undefined ? {} : { options }),
    ...(labels === undefined ? {} : { labels }),
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    ...(step === undefined ? {} : { step }),
    ...(condition === undefined ? {} : { if: condition })
  };
};

/**
 * The `argTypes` of the meta and the story, merged: each arg's entry from both, the story's fields over the meta's.
 *
 * @param meta - the meta's `argTypes`.
 * @param story - the story's `argTypes`.
 */
export const mergedArgTypes = (
  meta: unknown,
  story: unknown
): Readonly<Record<string, Readonly<Record<string, unknown>>>> => {
  const merged: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const part of [meta, story]) {
    if (!isRecord(part)) continue;
    for (const [name, entry] of Object.entries(part)) {
      if (isRecord(entry)) merged[name] = { ...merged[name], ...entry };
    }
  }
  return merged;
};

/**
 * The arg types the frame sends: each entry read, and the args `parameters.controls.exclude` names hidden.
 *
 * @param argTypes - the merged `argTypes`.
 * @param excluded - the args `parameters.controls.exclude` names.
 */
export const panelArgTypesOf = (
  argTypes: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
  excluded: readonly string[]
): PanelArgTypes => {
  const names = [...new Set([...Object.keys(argTypes), ...excluded])];
  return Object.fromEntries(
    names.map((name) => [name, panelArgTypeOf(argTypes[name] ?? {}, excluded.includes(name))])
  );
};

/**
 * The args with each `mapping` applied: an arg whose value is a key of its entry's `mapping` receives the value the
 * key stands for, as Storybook's (an arg written as the key in the story, or chosen in the panel).
 *
 * @param args - the args.
 * @param argTypes - the merged `argTypes`.
 */
export const mappedArgs = (
  args: Readonly<Record<string, unknown>>,
  argTypes: Readonly<Record<string, Readonly<Record<string, unknown>>>>
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(args).map(([name, value]) => {
      const mapping = argTypes[name]?.["mapping"];
      if (!isRecord(mapping) || (typeof value !== "string" && typeof value !== "number"))
        return [name, value];
      const key = String(value);
      // the mapping's own keys only: a value a shared link chose (`constructor`) never reaches its prototype
      return [name, Object.hasOwn(mapping, key) ? mapping[key] : value];
    })
  );

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
  none: "other"
};

/**
 * A prop with its arg type laid over it.
 *
 * @param prop - the prop as the types give it.
 * @param argType - its arg type.
 */
const withArgType = (prop: PropDocs, argType: PanelArgType): PanelProp => {
  const { control } = argType;
  // a control the panel cannot draw makes the prop one it lists for reading, never one that takes a text
  const isReadOnly = control === "none";
  const { canTakeText: _canTakeText, ...rest } = prop;
  return {
    ...(isReadOnly ? rest : prop),
    ...(control === undefined ? {} : { kind: KIND_OF_CONTROL[control], control }),
    ...(argType.options === undefined ? {} : { choices: argType.options }),
    ...(argType.description === undefined ? {} : { description: argType.description }),
    ...(argType.label === undefined ? {} : { label: argType.label }),
    ...(argType.labels === undefined ? {} : { labels: argType.labels }),
    ...(argType.min === undefined ? {} : { min: argType.min }),
    ...(argType.max === undefined ? {} : { max: argType.max }),
    ...(argType.step === undefined ? {} : { step: argType.step })
  };
};

/** A prop the types do not name, made from its arg type alone: a text when it names no control. */
const propOfArgType = (name: string, argType: PanelArgType): PanelProp =>
  withArgType({ name, kind: "text", type: "", description: "", isRequired: false }, argType);

/**
 * The panel's props: the component's, with their arg types laid over them, the hidden ones left out, then the args
 * only the arg types name, in their order.
 *
 * @param props - the props the component's types give.
 * @param argTypes - the story's arg types; none leaves the props as they are.
 */
export const panelProps = (props: readonly PropDocs[], argTypes: PanelArgTypes): readonly PanelProp[] => {
  const typed = new Set(props.map((prop) => prop.name));
  const fromTypes = props.flatMap((prop): PanelProp[] => {
    const argType = argTypes[prop.name];
    if (argType === undefined) return [prop];
    return argType.isHidden ? [] : [withArgType(prop, argType)];
  });
  const fromArgTypes = Object.entries(argTypes).flatMap(([name, argType]): PanelProp[] =>
    typed.has(name) || argType.isHidden ? [] : [propOfArgType(name, argType)]
  );
  return [...fromTypes, ...fromArgTypes];
};

/**
 * The props the panel can set, as the story's parameters say: `false` none, a list or `{ include }` those, anything
 * else every one.
 *
 * @param value - `parameters.controls`.
 */
export const controlsOfParameter = (value: unknown): StoryControlsSetting => {
  if (value === false) return [];
  if (Array.isArray(value) && value.every((name) => typeof name === "string")) return value;
  const include = isRecord(value) ? value["include"] : undefined;
  if (Array.isArray(include) && include.every((name) => typeof name === "string")) return include;
  return "all";
};

/**
 * The args `parameters.controls.exclude` hides.
 *
 * @param value - `parameters.controls`.
 */
export const excludedControls = (value: unknown): readonly string[] => {
  const exclude = isRecord(value) ? value["exclude"] : undefined;
  return Array.isArray(exclude) ? exclude.filter((name): name is string => typeof name === "string") : [];
};

/** Whether a value is one arg's panel arg type. */
const isPanelArgType = (value: unknown): value is PanelArgType =>
  isRecord(value) &&
  typeof value["isHidden"] === "boolean" &&
  (value["if"] === undefined || isArgCondition(value["if"])) &&
  (value["control"] === undefined || PANEL_CONTROLS.some((control) => control === value["control"])) &&
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

/** Whether a value is a spy (`fn()` of `storybook/test` or Vitest): a function with its calls under `mock`. */
const isSpy = (value: unknown): boolean => typeof value === "function" && "mock" in value;

/**
 * The args whose calls the Events tab records as actions: those whose value is a spy, and those whose `argTypes`
 * entry names an `action`. Explicit only: no arg is recorded for its name alone.
 *
 * @param args - the story's args.
 * @param argTypes - the merged `argTypes`.
 */
export const actionNames = (
  args: Readonly<Record<string, unknown>>,
  argTypes: Readonly<Record<string, Readonly<Record<string, unknown>>>>
): readonly string[] => [
  ...new Set([
    ...Object.entries(args).flatMap(([name, value]) => (isSpy(value) ? [name] : [])),
    ...Object.entries(argTypes).flatMap(([name, entry]) =>
      typeof entry["action"] === "string" || entry["action"] === true ? [name] : []
    )
  ])
];
