/**
 * A story's `argTypes` as its module writes them (Storybook's): read in the frame into the form that crosses to the shell
 * (`argTypes.ts`), and their `mapping` applied to the args the story receives. The commands read them the same way.
 *
 * @remarks
 * Option values that cannot cross (a component, a function) are sent as their `mapping` keys, which the frame turns back
 * into the values. Pure.
 *
 * @module
 */
import type { StoryControlsSetting } from "@forgebook/story-format/source";

import { argConditionOf } from "./argConditions.ts";
import type { PanelArgType, PanelArgTypes, PanelControl } from "./argTypes.ts";
import { isArgValue } from "./messages.ts";

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Storybook's control names, as the panel draws them (the inline variants look the same here). */
export const CONTROLS: Readonly<Record<string, PanelControl>> = {
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
  object: "object",
  file: "file",
  textarea: "textarea",
  token: "token"
};

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
  if (typeof control === "string") return Object.hasOwn(CONTROLS, control) ? CONTROLS[control] : undefined;
  if (isRecord(control)) {
    if (control["disable"] === true) return "none";
    const type = control["type"];
    if (typeof type === "string") return Object.hasOwn(CONTROLS, type) ? CONTROLS[type] : undefined;
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

/** A name among the controls an entry writes that is none of the panel's: a custom control's. */
const customControlOf = (control: unknown): string | undefined => {
  if (isRecord(control) && control["disable"] === true) return undefined;
  const name = isRecord(control) ? control["type"] : control;
  return typeof name === "string" && !Object.hasOwn(CONTROLS, name) ? name : undefined;
};

/** What a `token`, a `file` and a custom control say of themselves. */
const editorSettingsOf = (
  settings: Readonly<Record<string, unknown>>
): Pick<PanelArgType, "tokens" | "accept" | "settings"> => {
  const { of, format, accept } = settings;
  const own = settings["settings"];
  return {
    ...(own !== undefined && isArgValue(own) ? { settings: own } : {}),
    ...(typeof of === "string" ? { tokens: { of, ...(typeof format === "string" ? { format } : {}) } } : {}),
    ...(typeof accept === "string" ? { accept } : {})
  };
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
  const customControl = customControlOf(entry["control"]);
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
    ...(condition === undefined ? {} : { if: condition }),
    ...editorSettingsOf(settings),
    ...(customControl === undefined ? {} : { customControl })
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
