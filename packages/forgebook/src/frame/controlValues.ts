/**
 * The values of custom controls as each control's frame module turns them: the panel's into what the story receives
 * (`toStoryValue`, a name into the icon it names), and the story's own into the panel's (`toPanelValue`, the icon back
 * into its name). Loaded in a frame of a catalogue whose controls have frame modules, when the shell first gives it
 * values, so any other frame never asks for it.
 *
 * @remarks
 * Which control an arg has is read here as the panel reads it, from the story's `argTypes` and its component's docs (a
 * control the catalogue gives a prop by its type, `customControl`), with the same precedence: a control the story's
 * `argTypes` name wins. The frame reads it from its own story and docs, never from a message, which anything that embeds
 * the frame could send.
 *
 * A frame module is the catalogue's code, or a preset's, run in the stories' frame as a preview is, and it can be wrong in
 * every way: gone, throwing as it loads or as it turns a value, exporting something else. Each ends in a sentence the
 * frame reports, and the story keeps its own value of that arg: the panel's JSON is not what the story expects.
 *
 * @module
 */
import type { ArgControlFrameModule, FrameArgType } from "../argControl.ts";
import { type ArgValue, isArgValue, isUnsetArg, type PanelArgs } from "../messages.ts";
import { panelArgTypesOf } from "../storyArgTypes.ts";
import type { ControlFrameLoaders } from "./panelControls.ts";

/** What the frame modules made of the values. */
export type ControlValues = {
  /** What the story receives, by arg, over what the panel's JSON gives it. */
  readonly values: Readonly<Record<string, unknown>>;
  /** The args whose value could not be made: the story keeps its own. */
  readonly dropped: readonly string[];
  /** The story's own values as the panel shows them, by arg, for those a frame module names. */
  readonly own: PanelArgs;
  /** What went wrong, one sentence per failure. */
  readonly problems: readonly string[];
};

/** The story, as the frame modules read it. */
export type ControlStory = {
  /** Its own args. */
  readonly args: Readonly<Record<string, unknown>>;
  /** Its `argTypes`: the controls they name, and a control's `settings`. */
  readonly argTypes: Parameters<typeof panelArgTypesOf>[0];
  /** Loads its component's docs, which name the controls the catalogue gives props by type; none without docs. */
  readonly loadDocs?: (() => Promise<unknown>) | undefined;
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The controls the catalogue gives the component's props by type, by prop, from its docs as the plugin served them.
 *
 * @param docs - the docs module's value.
 */
const typedControlsOf = (docs: unknown): Readonly<Record<string, string>> => {
  const props = isRecord(docs) && Array.isArray(docs["props"]) ? docs["props"] : [];
  return Object.fromEntries(
    props.flatMap((prop: unknown): [string, string][] =>
      isRecord(prop) && typeof prop["name"] === "string" && typeof prop["customControl"] === "string"
        ? [[prop["name"], prop["customControl"]]]
        : []
    )
  );
};

/**
 * The custom control of each arg, as the panel draws it: a control the story's `argTypes` name, else the one the
 * catalogue gives the prop by type, unless the `argTypes` name another control for it.
 *
 * @param argTypes - the story's `argTypes`, as the panel reads them.
 * @param docs - its component's docs, as the plugin served them.
 */
export const argControlsOf = (
  argTypes: ReturnType<typeof panelArgTypesOf>,
  docs: unknown
): Readonly<Record<string, string>> => {
  const typed = Object.entries(typedControlsOf(docs)).filter(
    ([name]) => argTypes[name]?.control === undefined && argTypes[name]?.customControl === undefined
  );
  const named = Object.entries(argTypes).flatMap(([name, argType]): [string, string][] =>
    argType.customControl === undefined ? [] : [[name, argType.customControl]]
  );
  return Object.fromEntries([...typed, ...named]);
};

/** Each story file's docs, loaded once by the frame. */
const docsLoads = new Map<() => Promise<unknown>, Promise<unknown>>();

/**
 * A story's component docs, or none when they cannot load: the panel then has no docs either, so no control by type.
 *
 * @param load - the loader.
 */
const loadedDocs = (load: (() => Promise<unknown>) | undefined): Promise<unknown> => {
  if (load === undefined) return Promise.resolve(undefined);
  // a load that failed is tried again by the next values: the docs may be there by then
  const started =
    docsLoads.get(load) ??
    load().catch(() => {
      docsLoads.delete(load);
      return undefined;
    });
  docsLoads.set(load, started);
  return started;
};

/** Whether a module exports a `toStoryValue` function, and a `toPanelValue` function or none. */
const isFrameModule = (value: unknown): value is ArgControlFrameModule =>
  typeof value === "object" &&
  value !== null &&
  "toStoryValue" in value &&
  typeof value.toStoryValue === "function" &&
  (!("toPanelValue" in value) ||
    value.toPanelValue === undefined ||
    typeof value.toPanelValue === "function");

/** Each frame module's load, kept: every value of a page shares one. */
const loads = new Map<() => Promise<unknown>, Promise<unknown>>();

/** The reason an error gives. */
const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** A frame module, loaded once, or why it cannot be. */
const loadedModule = async (
  control: string,
  load: () => Promise<unknown>
): Promise<ArgControlFrameModule | string> => {
  try {
    const started = loads.get(load) ?? load();
    loads.set(load, started);
    const module = await started;
    return isFrameModule(module)
      ? module
      : `The control "${control}" names a frame module that exports no toStoryValue function`;
  } catch (error) {
    return `The control "${control}" could not load its frame module: ${reasonOf(error)}`;
  }
};

/** What one arg's control made of its values. */
type ArgOutcome = {
  /** The story's value, when the panel gave one and it could be made. */
  readonly value?: { readonly made: unknown };
  /** Whether the panel's value could not be made. */
  readonly isDropped: boolean;
  /** The panel's value of the story's own, when the module names it. */
  readonly own?: ArgValue;
  /** What went wrong. */
  readonly problems: readonly string[];
};

/**
 * One arg's values as its control's frame module turns them.
 *
 * @param module - the module.
 * @param control - the control's name.
 * @param argType - the arg.
 * @param args - the panel's values.
 * @param story - the story.
 */
const argOutcome = (
  module: ArgControlFrameModule,
  control: string,
  argType: FrameArgType,
  args: PanelArgs,
  story: ControlStory
): ArgOutcome => {
  const { name } = argType;
  const problems: string[] = [];
  let own: ArgValue | undefined;
  const ownValue = Object.hasOwn(story.args, name) ? story.args[name] : undefined;
  if (module.toPanelValue !== undefined && ownValue !== undefined) {
    try {
      const named: unknown = module.toPanelValue(ownValue, argType);
      own = named !== undefined && isArgValue(named) ? named : undefined;
    } catch (error) {
      problems.push(
        `The control "${control}" could not name the story's value of "${name}": ${reasonOf(error)}`
      );
    }
  }
  const named = own === undefined ? {} : { own };
  const given = Object.hasOwn(args, name) ? args[name] : undefined;
  if (given === undefined) return { isDropped: false, problems, ...named };
  // the panel's "no value" stays one: the story receives `undefined`, as for any arg
  if (isUnsetArg(given)) return { value: { made: undefined }, isDropped: false, problems, ...named };
  try {
    return { value: { made: module.toStoryValue(given, argType) }, isDropped: false, problems, ...named };
  } catch (error) {
    problems.push(`The control "${control}" could not turn the value of "${name}": ${reasonOf(error)}`);
    return { isDropped: true, problems, ...named };
  }
};

/**
 * The values of the controls with a frame module, as the story and the panel take them.
 *
 * @param args - the panel's values, checked by the shell.
 * @param loaders - the frame modules, by control.
 * @param story - the story's own args, its `argTypes` and its docs.
 */
export const controlValuesOf = async (
  args: PanelArgs,
  loaders: ControlFrameLoaders,
  story: ControlStory
): Promise<ControlValues> => {
  const types = panelArgTypesOf(story.argTypes, []);
  const controls = argControlsOf(types, await loadedDocs(story.loadDocs));
  const outcomes = await Promise.all(
    Object.entries(controls).flatMap(([name, control]) => {
      const load = Object.hasOwn(loaders, control) ? loaders[control] : undefined;
      if (load === undefined) return [];
      const settings = Object.hasOwn(types, name) ? types[name]?.settings : undefined;
      const argType: FrameArgType = { name, ...(settings === undefined ? {} : { settings }) };
      return [
        loadedModule(control, load).then((module): readonly [string, ArgOutcome] => [
          name,
          typeof module === "string"
            ? { isDropped: Object.hasOwn(args, name), problems: [module] }
            : argOutcome(module, control, argType, args, story)
        ])
      ];
    })
  );
  return {
    values: Object.fromEntries(
      outcomes.flatMap(([name, outcome]) => (outcome.value === undefined ? [] : [[name, outcome.value.made]]))
    ),
    dropped: outcomes.flatMap(([name, outcome]) => (outcome.isDropped ? [name] : [])),
    own: Object.fromEntries(
      outcomes.flatMap(([name, outcome]) => (outcome.own === undefined ? [] : [[name, outcome.own]]))
    ),
    // a module that fails is said once, however many args use it
    problems: [...new Set(outcomes.flatMap(([, outcome]) => outcome.problems))]
  };
};
