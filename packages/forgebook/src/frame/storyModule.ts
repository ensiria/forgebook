/**
 * A loaded story file read safely: the module is code the catalogue did not type-check against its own types, so
 * every part the frame uses is checked before use.
 *
 * @remarks
 * Objects, strings and lists are checked for their shape; a function's parameters cannot be checked at run time, so a
 * function is taken with the signature CSF gives it (a component, a render, a play function, a decorator). What a
 * component, a render and a decorator return is the framework's (`unknown` here); its renderer draws it.
 *
 * @module
 */

import type { ForcedState, ReplayMode, StoryContext, StoryParameters } from "@forgebook/story-format/csf";
import type { StoryControlsSetting } from "@forgebook/story-format/source";

/** Args as the frame handles them: whatever the story's component takes. */
export type LoadedArgs = Readonly<Record<string, unknown>>;

/** A component of the loaded file: what it returns is the framework's. */
export type LoadedComponent = (props: LoadedArgs) => unknown;

/** A decorator of the loaded file. */
export type LoadedDecorator = (story: () => unknown, context: StoryContext<LoadedArgs>) => unknown;

/** What the frame renders: the meta and one story, merged. */
export type LoadedStory = {
  /** The component, when the meta names one. */
  readonly component: LoadedComponent | undefined;
  /** The meta's args, then the story's. */
  readonly args: LoadedArgs;
  /** The story's render, when it has one. */
  readonly render: ((args: LoadedArgs, context: StoryContext<LoadedArgs>) => unknown) | undefined;
  /** The story's play function. */
  readonly play: ((context: StoryContext<LoadedArgs>) => Promise<void> | void) | undefined;
  /** The story's decorators first (innermost), then the meta's. */
  readonly decorators: readonly LoadedDecorator[];
  /** The states forced on the story's root. */
  readonly forceState: readonly ForcedState[];
  /** The replay, when declared. */
  readonly replay: ReplayMode | undefined;
  /** The props the panel can set: every adjustable one, or only these (none for fixed examples). */
  readonly controls: StoryControlsSetting;
  /** The layout in the frame. */
  readonly layout: NonNullable<StoryParameters["layout"]>;
  /** A Live story's clock start, in ms since the Unix epoch (`parameters.clock`); none for a still (D-504). */
  readonly clockStart: number | undefined;
};

/** A controls parameter, when valid: `false` is no prop, a list of names is those props. */
const controlsSetting = (value: unknown): StoryControlsSetting => {
  if (value === false) return [];
  if (Array.isArray(value) && value.every((name) => typeof name === "string")) return value;
  return "all";
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value can be called as a component, a render, a play function or a decorator. */
const isFunction = <TFunction>(value: unknown): value is TFunction => typeof value === "function";

/** An object's parameters, when it has some. */
const parametersOf = (part: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => {
  const parameters = part["parameters"];
  return isRecord(parameters) ? parameters : {};
};

/** The forced states a parameter lists. */
const forcedStates = (value: unknown): ForcedState[] => {
  const states: readonly unknown[] = Array.isArray(value) ? value : [value];
  return states.filter(
    (state): state is ForcedState =>
      state === "hover" ||
      state === "active" ||
      state === "focus" ||
      state === "focus-visible" ||
      state === "focus-within"
  );
};

/** A replay parameter, when valid. */
const replayMode = (value: unknown): ReplayMode | undefined => {
  if (value === "remount") return value;
  if (isRecord(value) && typeof value["toggle"] === "string") {
    const hold = value["hold"];
    return typeof hold === "number" && hold > 0
      ? { toggle: value["toggle"], hold }
      : { toggle: value["toggle"] };
  }
  return undefined;
};

/** A clock parameter's start, when it names a valid instant. */
const clockStartOf = (value: unknown): number | undefined => {
  if (!isRecord(value) || typeof value["start"] !== "string") return undefined;
  const start = Date.parse(value["start"]);
  return Number.isNaN(start) ? undefined : start;
};

/** The decorators of a part. */
const decoratorsOf = (part: Readonly<Record<string, unknown>>): LoadedDecorator[] => {
  const decorators = part["decorators"];
  return Array.isArray(decorators) ? decorators.filter(isFunction<LoadedDecorator>) : [];
};

/**
 * The meta and one story of a loaded module, merged.
 *
 * @param module - the module, as `import()` gave it.
 * @param exportName - the story's named export.
 * @param previewParameters - the catalogue's preview's parameters, under the meta's and the story's; none by default.
 * @returns what the frame renders, or why it cannot.
 */
export const readStory = (
  module: unknown,
  exportName: string,
  previewParameters: Readonly<Record<string, unknown>> = {}
): LoadedStory | string => {
  if (!isRecord(module)) return "The story file did not load as a module";
  const meta = module["default"];
  const story = module[exportName];
  if (!isRecord(meta)) return "The story file has no meta (its default export)";
  if (!isRecord(story)) return `The story file has no story "${exportName}"`;
  const metaArgs = isRecord(meta["args"]) ? meta["args"] : {};
  const storyArgs = isRecord(story["args"]) ? story["args"] : {};
  const parameters = { ...previewParameters, ...parametersOf(meta), ...parametersOf(story) };
  const layout = parameters["layout"];
  return {
    component: isFunction<LoadedComponent>(meta["component"]) ? meta["component"] : undefined,
    args: { ...metaArgs, ...storyArgs },
    render: isFunction<LoadedStory["render"]>(story["render"]) ? story["render"] : undefined,
    play: isFunction<LoadedStory["play"]>(story["play"]) ? story["play"] : undefined,
    decorators: [...decoratorsOf(story), ...decoratorsOf(meta)],
    forceState: forcedStates(parameters["forceState"]),
    replay: replayMode(parameters["replay"]),
    controls: controlsSetting(parameters["controls"]),
    layout: layout === "centered" || layout === "fullscreen" ? layout : "padded",
    clockStart: clockStartOf(parameters["clock"])
  };
};

/** A catalogue's preview, read: its decorators, its parameters and its setup. */
export type LoadedPreview = {
  /** Its decorators, innermost first. */
  readonly decorators: readonly LoadedDecorator[];
  /** Its parameters, under every meta's. */
  readonly parameters: Readonly<Record<string, unknown>>;
  /** What runs once before any story renders; nothing when it has none. */
  readonly setup: (() => Promise<void>) | undefined;
};

/** The preview of a catalogue that has none. */
export const NO_PREVIEW: LoadedPreview = { decorators: [], parameters: {}, setup: undefined };

/**
 * A catalogue's preview read safely, as a story file is: from the default export of its module, or the module itself.
 *
 * @param module - the preview's module, as `import()` gave it; none for a catalogue without one.
 */
export const readPreview = (module: unknown): LoadedPreview => {
  if (!isRecord(module)) return NO_PREVIEW;
  const preview = isRecord(module["default"]) ? module["default"] : module;
  const setup = preview["setup"];
  return {
    decorators: decoratorsOf(preview),
    parameters: parametersOf(preview),
    setup: isFunction<() => Promise<void>>(setup) ? setup : undefined
  };
};

/**
 * Previews read one after another, as a catalogue's presets and its own: decorators of the later ones outside the
 * earlier ones', parameters of the later ones over the earlier ones', every setup in order.
 *
 * @param previews - the previews, the catalogue's own last.
 */
export const mergedPreviews = (previews: readonly LoadedPreview[]): LoadedPreview => {
  const setups = previews.flatMap((preview) => (preview.setup === undefined ? [] : [preview.setup]));
  return {
    decorators: previews.flatMap((preview) => preview.decorators),
    parameters: Object.fromEntries(previews.flatMap((preview) => Object.entries(preview.parameters))),
    setup:
      setups.length === 0
        ? undefined
        : async (): Promise<void> => {
            for (const setup of setups) await setup();
          }
  };
};
