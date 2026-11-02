/**
 * A loaded story file read safely: the module is code the catalogue did not type-check against its own types, so
 * every part the frame uses is checked before use.
 *
 * @remarks
 * Objects, strings and lists are checked for their shape; a function's parameters cannot be checked at run time, so a
 * function is taken with the signature CSF gives it (a render, a play function, a decorator). What a render and a
 * decorator return is the framework's (`unknown` here); its renderer draws it. The meta's component is the framework's
 * too: a function, or an object some frameworks make one of (React's `memo` and `forwardRef`), so the frame passes on
 * whatever the meta names and the renderer reads it.
 *
 * A story is an object (CSF 3) or a function (CSF 2: the function is its render, its args and parameters are
 * properties assigned to it). The meta may give the render and the play function every story without its own uses.
 *
 * @module
 */

import type {
  ForcedState,
  ReplayMode,
  StoryBeforeEach,
  StoryContext,
  StoryLoader,
  StoryParameters,
  StoryPlayContext
} from "@forgebook/story-format/csf";
import type { StoryControlsSetting } from "@forgebook/story-format/source";

import { controlsOfParameter, mergedArgTypes } from "../argTypes.ts";

/** Args as the frame handles them: whatever the story's component takes. */
export type LoadedArgs = Readonly<Record<string, unknown>>;

/** A component of the loaded file, as the framework makes one: a function, or an object (React's `memo`). */
export type LoadedComponent = NonNullable<unknown>;

/** A decorator of the loaded file. */
export type LoadedDecorator = (story: () => unknown, context: StoryContext<LoadedArgs>) => unknown;

/** A loader of the loaded file or the preview. */
export type LoadedLoader = StoryLoader<LoadedArgs>;

/** A `beforeEach` of the loaded file or the preview. */
export type LoadedBeforeEach = StoryBeforeEach<LoadedArgs>;

/** What the frame renders: the meta and one story, merged. */
export type LoadedStory = {
  /** The component, when the meta names one. */
  readonly component: LoadedComponent | undefined;
  /** The meta's args, then the story's. */
  readonly args: LoadedArgs;
  /** The story's render, or the meta's, when either has one. */
  readonly render: ((args: LoadedArgs, context: StoryContext<LoadedArgs>) => unknown) | undefined;
  /** The story's play function, or the meta's. */
  readonly play: ((context: StoryPlayContext<LoadedArgs>) => Promise<void> | void) | undefined;
  /** The story's decorators first (innermost), then the meta's. */
  readonly decorators: readonly LoadedDecorator[];
  /** The loaders: the preview's, then the meta's, then the story's. */
  readonly loaders: readonly LoadedLoader[];
  /** The set-ups, in the order they run: the preview's, then the meta's, then the story's. */
  readonly beforeEach: readonly LoadedBeforeEach[];
  /** The states forced on the story's root. */
  readonly forceState: readonly ForcedState[];
  /** The replay, when declared. */
  readonly replay: ReplayMode | undefined;
  /** The `globals` of the meta and the story, the story's over the meta's: what it fixes of the view. */
  readonly globals: Readonly<Record<string, unknown>>;
  /** The `argTypes` of the meta and the story, merged by arg (the story's fields over the meta's). */
  readonly argTypes: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /** The props the panel can set: every adjustable one, or only these (none for fixed examples). */
  readonly controls: StoryControlsSetting;
  /** The parameters: the preview's, under the meta's, under the story's. */
  readonly parameters: Readonly<Record<string, unknown>>;
  /** The layout in the frame. */
  readonly layout: NonNullable<StoryParameters["layout"]>;
  /** A Live story's clock start, in ms since the Unix epoch (`parameters.clock`); none for a still. */
  readonly clockStart: number | undefined;
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A story's fields: a CSF 3 story's object, or a CSF 2 story's function with the properties assigned to it.
 *
 * @param story - the named export.
 */
const storyFieldsOf = (story: unknown): Readonly<Record<string, unknown>> | undefined => {
  if (isRecord(story)) return story;
  if (typeof story !== "function") return undefined;
  // a function story's properties are its own: `Primary.args = …` sets them on the function itself
  const fields: Record<string, unknown> = { render: story };
  for (const name of Object.keys(story)) fields[name] = Reflect.get(story, name);
  return fields;
};

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
 * The functions a part writes under a name, one or a list (CSF's `loaders` and `beforeEach` take either).
 *
 * @param part - the meta, the story or the preview.
 * @param name - the field.
 */
const functionsOf = <TFunction>(part: Readonly<Record<string, unknown>>, name: string): TFunction[] => {
  const value = part[name];
  const list: readonly unknown[] = Array.isArray(value) ? value : [value];
  return list.filter(isFunction<TFunction>);
};

/**
 * A function the story names, or else the meta's.
 *
 * @param story - the story's fields.
 * @param meta - the meta.
 * @param name - the field (`render`, `play`).
 */
const ownOrMeta = <TFunction>(
  story: Readonly<Record<string, unknown>>,
  meta: Readonly<Record<string, unknown>>,
  name: string
): TFunction | undefined => {
  const own = story[name];
  if (isFunction<TFunction>(own)) return own;
  const fromMeta = meta[name];
  return isFunction<TFunction>(fromMeta) ? fromMeta : undefined;
};

/**
 * The meta and one story of a loaded module, merged.
 *
 * @param module - the module, as `import()` gave it.
 * @param exportName - the story's named export.
 * @param preview - the catalogue's preview: its parameters under the meta's and the story's, its loaders and set-ups
 *   before theirs (its decorators are the renderer's to put outside); none by default.
 * @returns what the frame renders, or why it cannot.
 */
export const readStory = (
  module: unknown,
  exportName: string,
  preview: LoadedPreview = NO_PREVIEW
): LoadedStory | string => {
  if (!isRecord(module)) return "The story file did not load as a module";
  const meta = module["default"];
  const story = storyFieldsOf(module[exportName]);
  if (!isRecord(meta)) return "The story file has no meta (its default export)";
  if (story === undefined) return `The story file has no story "${exportName}"`;
  const metaArgs = isRecord(meta["args"]) ? meta["args"] : {};
  const storyArgs = isRecord(story["args"]) ? story["args"] : {};
  const parameters = { ...preview.parameters, ...parametersOf(meta), ...parametersOf(story) };
  const layout = parameters["layout"];
  return {
    component: meta["component"] ?? undefined,
    args: { ...preview.args, ...metaArgs, ...storyArgs },
    render: ownOrMeta<LoadedStory["render"]>(story, meta, "render"),
    play: ownOrMeta<LoadedStory["play"]>(story, meta, "play"),
    decorators: [...decoratorsOf(story), ...decoratorsOf(meta)],
    loaders: [
      ...preview.loaders,
      ...functionsOf<LoadedLoader>(meta, "loaders"),
      ...functionsOf<LoadedLoader>(story, "loaders")
    ],
    beforeEach: [
      ...preview.beforeEach,
      ...functionsOf<LoadedBeforeEach>(meta, "beforeEach"),
      ...functionsOf<LoadedBeforeEach>(story, "beforeEach")
    ],
    forceState: forcedStates(parameters["forceState"]),
    parameters,
    replay: replayMode(parameters["replay"]),
    controls: controlsOfParameter(parameters["controls"]),
    argTypes: mergedArgTypes(mergedArgTypes(preview.argTypes, meta["argTypes"]), story["argTypes"]),
    globals: {
      ...(isRecord(meta["globals"]) ? meta["globals"] : {}),
      ...(isRecord(story["globals"]) ? story["globals"] : {})
    },
    layout: layout === "centered" || layout === "fullscreen" ? layout : "padded",
    clockStart: clockStartOf(parameters["clock"])
  };
};

/** A catalogue's preview, read: its decorators, its parameters, its setup, its loaders and set-ups. */
export type LoadedPreview = {
  /** Its decorators, innermost first. */
  readonly decorators: readonly LoadedDecorator[];
  /** Its loaders, before every story's. */
  readonly loaders: readonly LoadedLoader[];
  /** Its set-ups, before every story's. */
  readonly beforeEach: readonly LoadedBeforeEach[];
  /** Its args, under every meta's (Storybook's project args). */
  readonly args: LoadedArgs;
  /** Its `argTypes`, under every meta's. */
  readonly argTypes: Readonly<Record<string, unknown>>;
  /** Its parameters, under every meta's. */
  readonly parameters: Readonly<Record<string, unknown>>;
  /** The globals it starts from, under the switches': what its decorators read. */
  readonly globals: Readonly<Record<string, string>>;
  /** What runs once before any story renders; nothing when it has none. */
  readonly setup: (() => Promise<void>) | undefined;
};

/** The preview of a catalogue that has none. */
export const NO_PREVIEW: LoadedPreview = {
  decorators: [],
  loaders: [],
  beforeEach: [],
  args: {},
  argTypes: {},
  parameters: {},
  globals: {},
  setup: undefined
};

/**
 * The entries of an object whose values are texts, by the same keys.
 *
 * @param values - the values by key.
 */
const textsOf = (values: Readonly<Record<string, unknown>>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(values).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : []))
  );

/**
 * The globals a preview starts from, as Storybook starts them: each `globalTypes` entry's `defaultValue`, under
 * `initialGlobals`. Its decorators read them before anyone touches a toolbar, so without them a decorator that calls
 * `context.globals.scheme.startsWith` fails on every story. Only texts: `context.globals` holds texts.
 *
 * @param preview - the preview's fields.
 */
const previewGlobals = (preview: Readonly<Record<string, unknown>>): Record<string, string> => {
  const types = isRecord(preview["globalTypes"]) ? preview["globalTypes"] : {};
  const defaults = Object.fromEntries(
    Object.entries(types).map(([id, type]) => [id, isRecord(type) ? type["defaultValue"] : undefined])
  );
  const initial = isRecord(preview["initialGlobals"]) ? preview["initialGlobals"] : {};
  return { ...textsOf(defaults), ...textsOf(initial) };
};

/**
 * A catalogue's preview read safely, as a story file is: field by field, as Storybook reads one, the default export's
 * value or else the module's named export. A preview often writes both (`export const decorators` beside
 * `export default preview`), and reading only one of them would drop the other's providers without a word.
 *
 * @param module - the preview's module, as `import()` gave it; none for a catalogue without one.
 */
export const readPreview = (module: unknown): LoadedPreview => {
  if (!isRecord(module)) return NO_PREVIEW;
  const preview = isRecord(module["default"]) ? { ...module, ...module["default"] } : module;
  const setup = preview["setup"];
  return {
    decorators: decoratorsOf(preview),
    loaders: functionsOf<LoadedLoader>(preview, "loaders"),
    beforeEach: functionsOf<LoadedBeforeEach>(preview, "beforeEach"),
    args: isRecord(preview["args"]) ? preview["args"] : {},
    argTypes: isRecord(preview["argTypes"]) ? preview["argTypes"] : {},
    parameters: parametersOf(preview),
    globals: previewGlobals(preview),
    setup: isFunction<() => Promise<void>>(setup) ? setup : undefined
  };
};

/**
 * Previews read one after another, as a catalogue's presets and its own: decorators of the later ones outside the
 * earlier ones', parameters of the later ones over the earlier ones', every setup, loader and set-up in order.
 *
 * @param previews - the previews, the catalogue's own last.
 */
export const mergedPreviews = (previews: readonly LoadedPreview[]): LoadedPreview => {
  const setups = previews.flatMap((preview) => (preview.setup === undefined ? [] : [preview.setup]));
  return {
    decorators: previews.flatMap((preview) => preview.decorators),
    loaders: previews.flatMap((preview) => preview.loaders),
    beforeEach: previews.flatMap((preview) => preview.beforeEach),
    args: Object.assign({}, ...previews.map((preview) => preview.args)),
    argTypes: previews.reduce<Readonly<Record<string, unknown>>>(
      (merged, preview) => mergedArgTypes(merged, preview.argTypes),
      {}
    ),
    parameters: Object.fromEntries(previews.flatMap((preview) => Object.entries(preview.parameters))),
    globals: Object.assign({}, ...previews.map((preview) => preview.globals)),
    setup:
      setups.length === 0
        ? undefined
        : async (): Promise<void> => {
            for (const setup of setups) await setup();
          }
  };
};
