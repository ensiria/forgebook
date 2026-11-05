/**
 * The story format: Component Story Format 3, the subset Forgebook reads.
 *
 * @remarks
 * A story file exports its meta as the default export and each story as a named export, as CSF requires, so
 * Storybook or Ladle could read the same files. The types cover only what the catalogue reads; anything else
 * in a story file is left alone. The format is its own package so the packages that write stories depend on it, not
 * on the catalogue that shows them. Parameters the catalogue adds (`forceState`, `replay`) sit under `parameters`, where CSF
 * keeps tool-specific settings.
 * A Live story (`parameters.clock`) reads the story clock the catalogue runs (`./clock`).
 *
 * The types are generic over a renderer, as Storybook's are: what a framework's component is and what a render
 * returns. A framework's package names them for its own (`Meta<typeof Button>` in `@forgebook/react`), and story
 * files import them from there; nothing here depends on a framework.
 *
 * @module
 */
// a story draws in a page (`canvasElement`): code on Node that reads these types (the catalogue's plugin) gets the DOM's
// types from here
/// <reference lib="dom" />

import type { StoryClock, StoryClockSetting } from "./clock.ts";
import type { StoryTextArg, StoryTextFunction } from "./texts.ts";

/**
 * A framework, as the story types read it: what a meta names as its component, and what a render, a decorator and a
 * language's provider return.
 */
export type Renderer = {
  /** A component of the framework. */
  readonly component: unknown;
  /** What a story draws (`ReactNode` in React). */
  readonly storyResult: unknown;
  /**
   * What a decorator's `story()` gives, for a framework where it is narrower than what a story may return (Vue: a story
   * may return a component, but `story()` is a virtual node); `storyResult` without it.
   */
  readonly decoratedStory?: unknown;
};

/** A value a story's args may write for a prop: the prop's own, or, where it takes a text, a text named by its key. */
export type WrittenArg<TValue> = string extends TValue ? TValue | StoryTextArg : TValue;

/** An interaction state the catalogue can show without the pointer or the keyboard (`parameters.forceState`). */
export type ForcedState = "hover" | "active" | "focus" | "focus-visible" | "focus-within";

/**
 * How the Replay control replays a story: `remount` mounts it again (an entrance), `{ toggle }` sets that boolean arg
 * to false and, once the exit has played, back to true (an exit and an entrance).
 */
export type ReplayMode =
  | "remount"
  | {
      /** The boolean arg turned false then true again. */
      readonly toggle: string;
      /** How long the arg stays false once the exit has played, in ms (a loading phase to watch); none by default. */
      readonly hold?: number;
    };

/** How a device is held: upright, or turned on its side with its top to the left. */
export type DeviceOrientation = "portrait" | "landscape";

/**
 * The device a story is shown in by default (`parameters.device`): a drawn phone or tablet around it, at the model's
 * real viewport size, which the person can still turn off, change or rotate. Each field is optional: a story's own
 * fields win over the meta's, which win over the catalogue's `device`.
 */
export type StoryDeviceSetting = {
  /** Whether the story starts in the device frame; `false` by default, and on a story it leaves the meta's out. */
  readonly frame?: boolean;
  /**
   * The model, by id (`iphone-16`; the catalogue's documentation lists them): the one the frame shows, and the one
   * the toolbar's toggle turns on; `phone`, a generic phone, by default.
   */
  readonly model?: string;
  /** How the device is held; `portrait` by default. */
  readonly orientation?: DeviceOrientation;
  /**
   * Whether the story is touched with the catalogue's simulated finger while it is in the device, as a phone is;
   * `true` by default. The reader can still turn touch off for it.
   */
  readonly touch?: boolean;
  /**
   * Whether the story draws edge to edge, under the status bar and the home indicator, as a full-screen app does; it
   * then pads itself with the safe areas the frame writes as custom properties (`--forgebook-safe-area-top`…), since
   * `env(safe-area-inset-*)` stays zero in a frame. `false` by default: the story sits inside the safe areas.
   */
  readonly edgeToEdge?: boolean;
};

/**
 * A group of stories in the sidebar (`states`, `in-context`): its order and heading come from the catalogue's
 * configuration (or a library's preset); a group it does not name sits after the named ones.
 */
export type StoryGroup = string;

/** The controls an arg can have in the props panel, as Storybook names them. */
export type ArgControlType =
  | "select"
  | "radio"
  | "inline-radio"
  | "check"
  | "inline-check"
  | "multi-select"
  | "boolean"
  | "text"
  | "number"
  | "range"
  | "color"
  | "date"
  | "object"
  | "file";

/** An arg's control: its type, or `false` for none, or the type with its settings. */
export type ArgControl =
  | ArgControlType
  | false
  | {
      /** The control; from the arg's type when left out. */
      readonly type?: ArgControlType;
      /** The names the panel shows for the options, by option. */
      readonly labels?: Readonly<Record<string, string>>;
      /** A range's or a number's lowest value. */
      readonly min?: number;
      /** A range's or a number's highest value. */
      readonly max?: number;
      /** A range's or a number's step. */
      readonly step?: number;
      /** Whether the control is off: the arg is shown, not set. */
      readonly disable?: boolean;
    };

/**
 * How the props panel shows one arg (Storybook's `argTypes`): over what the component's types say, or alone for an
 * arg the types do not name. The story's entry is laid over the meta's.
 */
export type ArgType = {
  /** The name the panel shows; the arg's by default. */
  readonly name?: string;
  /** What the arg does, over its TSDoc. */
  readonly description?: string;
  /** Its control. */
  readonly control?: ArgControl;
  /** The values a choice offers: texts or numbers, or keys of `mapping`. */
  readonly options?: readonly unknown[];
  /** The value each option stands for, by option: the panel sends the option, the story receives the value. */
  readonly mapping?: Readonly<Record<string, unknown>>;
  /** The table's settings: `disable` hides the arg from the panel. */
  readonly table?: { readonly disable?: boolean };
  /** Records the arg's calls in the Events tab, under this name (Storybook's actions); a spy (`fn()`) is recorded too. */
  readonly action?: string;
};

/** A story's or a meta's `argTypes`, by arg. */
export type ArgTypes<TArgs> = { readonly [Name in keyof TArgs]?: ArgType } & Readonly<
  Record<string, ArgType>
>;

/**
 * Where a component's required props are listed in its API reference and Props tab: `in-groups` puts them first
 * inside each group (and in the props that name none), `section` lists them all in one "Required" section before
 * every group, each naming its group, and `false` keeps the order of the source.
 */
export type RequiredFirst = "in-groups" | "section" | false;

/** A component's or a story's design, in the tool it was drawn in. */
export type StoryDesign = {
  /**
   * The link to its node in Figma (`https://www.figma.com/design/<file>/<name>?node-id=12-34`), or to its file. Written
   * plainly (the index reads it). A link that is not Figma's is reported and never embedded.
   */
  readonly figma: string;
};

/** The settings the catalogue reads from a meta or a story; anything else under `parameters` is left alone. */
export type StoryParameters = {
  /** The states forced on the whole story; a part can force its own with `data-forgebook-force`. */
  readonly forceState?: ForcedState | readonly ForcedState[];
  /** Shows the Replay control and says what it does. */
  readonly replay?: ReplayMode;
  /**
   * The props the panel can set for the story: every adjustable prop by default, only the listed ones, or none
   * (`false`) for a story that draws fixed examples and ignores its args, which then shows no props (its column stays, empty, so the story keeps its width). With a list, the
   * others are listed without a control. Storybook's `{ include, exclude }` is read too: `include` as the list,
   * `exclude` hiding those args.
   */
  readonly controls?:
    | false
    | readonly string[]
    | { readonly include?: readonly string[]; readonly exclude?: readonly string[] };
  /** The story's group in the sidebar, a plain string (the index reads it); none puts it above the groups. */
  readonly group?: StoryGroup;
  /**
   * Whether the story is the component's demo, drawn at the top of its page: one real, well-made use of it, not a
   * matrix of its values. Written plainly (`main: true`, the index reads it); without one, the page shows `Overview`.
   */
  readonly main?: boolean;
  /**
   * The height the story's scene needs, in CSS px: the frame has it from the start, so an overlay the story opens is
   * placed once, as in a window of that size, instead of flipping or scrolling in a frame only as tall as the story's
   * own content. The frame still grows past it with its content. Written plainly (`height: 320`, the index
   * reads it).
   */
  readonly height?: number;
  /**
   * Whether the story is meant for a phone: it starts touched with the catalogue's simulated finger, whatever the
   * toolbar's Touch switch says, and its example and its page offer to turn that off for it. On a meta, for every
   * story of the file; a story's own `false` leaves it out. Written plainly (`touch: true`, the index reads it).
   */
  readonly touch?: boolean;
  /**
   * Whether the story is about logic, not looks: a small scene that uses a hook or a function, there to document and
   * try what it does. The catalogue marks it, puts the signature of the meta's `component` (the hook) first, and tests
   * it once instead of in every look; it leaves out its reference images. On a meta, for every story of the file; a
   * story's own `false` leaves it out. Written plainly (`logic: true`, the index reads it).
   */
  readonly logic?: boolean;
  /**
   * The device the story is shown in by default: `{ frame: true, model: "iphone-16" }` draws an iPhone 16 around it,
   * at its viewport, on the story's page and on its component's page. On a meta, for every story of the file; a
   * story's own fields win. Written plainly (the index reads it); off by default.
   */
  readonly device?: StoryDeviceSetting;
  /**
   * The design this is drawn from: on a meta, the component's and every story's; on a story, its own in place of the
   * meta's. The catalogue links to it, and with a design plugin (`@forgebook/plugin-figma`) shows it in a Design tab
   * beside the story.
   */
  readonly design?: StoryDesign;
  /**
   * The story reads the story clock (`context.clock`, `useStoryNow`): a Live story, which starts at this moment and
   * then runs; the catalogue shows pause, resume, restart and the speed, and the tests hold it at its start.
   * None by default: the clock is held at the Unix epoch and the catalogue shows no clock controls.
   */
  readonly clock?: StoryClockSetting;
  /** How the story sits in its frame: padded (default), centred, or the whole frame. */
  readonly layout?: "padded" | "centered" | "fullscreen";
  /**
   * The story's mocked API: MSW's request handlers, which answer what the story fetches while it is shown. A list, or
   * a record of lists as MSW's Storybook addon writes it. Typed `unknown` here, since this package depends on nothing:
   * they are MSW's `http.get(…)` values.
   */
  readonly msw?: {
    /** The handlers. */
    readonly handlers: readonly unknown[] | Readonly<Record<string, readonly unknown[]>>;
  };
  /**
   * On a meta: the component's prop groups to list first in its API reference and Props tab, in this order, by the
   * name their props' TSDoc gives (`@group Selection`), ahead of the catalogue's own order; the others follow as they
   * first appear. Written plainly, a list of string literals (the index reads it).
   */
  readonly propGroups?: readonly string[];
  /**
   * Where the required props are listed (`RequiredFirst`): on a meta, for the component's page and every story's
   * Props tab; on a story, for its own Props tab, over the meta's. Both win over the catalogue's `requiredFirst`;
   * a reader's "Required first" switch turns the ordering on or off over all three, never choosing the layout.
   * `in-groups` by default. Written plainly, `"in-groups"`, `"section"` or `false` (the index reads it).
   */
  readonly requiredFirst?: RequiredFirst;
  /** CSF's documentation block; the catalogue reads the component's one-line description from it. */
  readonly docs?: { readonly description?: { readonly component?: string } };
};

/**
 * Names a part of a play function: the catalogue's Interactions tab lists each step with its status and time, so a
 * failing play shows where it stopped. Outside a play, it only runs the part.
 */
export type StepFunction = (label: string, run: () => Promise<void> | void) => Promise<void>;

/** What a story's render, play and decorators receive. */
export type StoryContext<TArgs> = {
  /** The args: the meta's, the story's and the props panel's, merged in that order. */
  readonly args: TArgs;
  /** The element the story renders into. */
  readonly canvasElement: HTMLElement;
  /** Names a part of the play function (CSF's `step`). */
  readonly step: StepFunction;
  /** The text of a key in the shown language (`stories/locales/<id>.json`), its `{name}` placeholders filled. */
  readonly text: StoryTextFunction;
  /**
   * The story clock: the time a Live story reads, and what its play function advances instead of waiting; held at
   * the Unix epoch when the story declares no `parameters.clock`.
   */
  readonly clock: StoryClock;
  /**
   * The globals a decorator reads to pick a provider's theme, a density, a locale, by id (CSF's name): the preview's
   * starting values (its `globalTypes` defaults, under `initialGlobals`), under the meta's and the story's own, under
   * the catalogue's switches applied by code. Text values only. Empty outside a catalogue.
   */
  readonly globals: Readonly<Record<string, string>>;
  /** What the story's loaders returned, merged: the preview's, then the meta's, then the story's (CSF's `loaded`). */
  readonly loaded: Readonly<Record<string, unknown>>;
  /** The story's id in the catalogue (`kit:inputs-select--overview`). */
  readonly id: string;
  /** The story's name as the catalogue shows it (`Keyboard open`). */
  readonly name: string;
  /** The title of its file's meta (`Inputs/Select`). */
  readonly title: string;
  /** The story's parameters: the preview's, under the meta's, under its own. */
  readonly parameters: Readonly<Record<string, unknown>>;
};

/**
 * What a play function receives besides the story's context, filled in by the libraries the project installs.
 *
 * @remarks
 * Empty here: Forgebook depends on no testing library. A project that installs `@testing-library/dom` and
 * `@testing-library/user-event` gets `canvas` and `userEvent` in every play, and imports
 * `@forgebook/story-format/testing-library` once to type them (it adds them to this interface).
 */
// biome-ignore lint/suspicious/noEmptyInterface: an interface other modules add to (declaration merging), empty until one does
export interface StoryPlayTools {}

/** What a play function receives: the story's context, its `step`, and the play tools the project installed. */
export type StoryPlayContext<TArgs> = StoryContext<TArgs> & StoryPlayTools;

/**
 * What a loader and a `beforeEach` receive: the story's args and what it is shown with, before it is drawn. No canvas:
 * they also run before a story is drawn on the server, where there is none.
 */
export type StoryHookContext<TArgs> = Pick<
  StoryContext<TArgs>,
  "args" | "text" | "clock" | "globals" | "loaded" | "id" | "name" | "title" | "parameters"
>;

/**
 * Fetches what a story needs before it is drawn (CSF's loader): what it returns reaches the story's render, play and
 * decorators as `context.loaded`. Every loader of a story runs at once; a later one's key wins (the story's over the
 * meta's over the preview's). It receives an empty `loaded`.
 */
export type StoryLoader<TArgs> = (
  context: StoryHookContext<TArgs>
) => Promise<Readonly<Record<string, unknown>> | undefined> | Readonly<Record<string, unknown>> | undefined;

/** Undoes what a `beforeEach` set up: run when the story is mounted again or its frame is left. */
export type StoryCleanup = () => Promise<void> | void;

/**
 * Sets up what a story needs before it is drawn, after its loaders (CSF's `beforeEach`: a mocked date, a stored
 * value), one after another: the preview's, the meta's, the story's. It may return the cleanup that undoes it.
 */
export type StoryBeforeEach<TArgs> = (
  context: StoryHookContext<TArgs>
) => Promise<StoryCleanup | undefined> | StoryCleanup | undefined;

/** One function of a kind, or a list of them, as CSF lets a meta, a story or a preview write it. */
export type OneOrMany<TFunction> = TFunction | readonly TFunction[];

/** Wraps a story: a provider, a container of a given width. */
export type Decorator<TRenderer extends Renderer, TArgs> = (
  story: () => TRenderer extends { readonly decoratedStory: infer TStory }
    ? TStory
    : TRenderer["storyResult"],
  context: StoryContext<TArgs>
) => TRenderer["storyResult"];

/**
 * A story file's default export, for a framework: `TComponent` is the component it shows, `TArgs` what its render
 * receives and `TWrittenArgs` what its args may write (a framework's package derives both from the component's props).
 */
export type CsfMeta<TRenderer extends Renderer, TComponent, TArgs, TWrittenArgs> = {
  /**
   * Where it sits in the catalogue: `Family/Name` or `Family/Group/Name` (`Inputs/Selection/Select`); any depth is
   * placed. Written plainly; without one, the file's path from its pattern's folder is the title.
   */
  readonly title?: string;
  /** The component the stories show; their args are its props. */
  readonly component?: TComponent;
  /**
   * The parts the component is used with that have no story file of their own (`{ ChipList }` beside `Chip`), by the
   * name the catalogue shows: the component's page lists each one's props under its own. Storybook's
   * `subcomponents`, so the stories stay readable by it. Written in the meta as an object of imported components: the
   * catalogue reads it without running the file.
   */
  readonly subcomponents?: Readonly<Record<string, TRenderer["component"]>>;
  /** Args every story of the file starts from. */
  readonly args?: TWrittenArgs;
  /** How the props panel shows the args (Storybook's `argTypes`). */
  readonly argTypes?: ArgTypes<TWrittenArgs>;
  /**
   * The catalogue's switches the story fixes, by the switch's id (`{ theme: "dark" }`), and Storybook's
   * `backgrounds` and `viewport` (`{ backgrounds: { value: "dark" } }`): drawn so whatever the toolbar says, which
   * shows them as set by the story.
   */
  readonly globals?: Readonly<Record<string, unknown>>;
  /**
   * Other places the catalogue lists the component in, besides its title's, as `Family` or `Family/Group`
   * (`["Data/Tables"]`): a component that belongs to one family but is looked for in another. Each place shows an
   * entry marked as living elsewhere that opens the same page, so nothing is duplicated: no second story, test or
   * image. Written plainly, a list of string literals: the catalogue reads it without running the file.
   */
  readonly alsoIn?: readonly string[];
  /**
   * The titles of related components of the same source (`["Layout/Inline"]`): each page names the other at its top,
   * both ways, so writing the link in one meta is enough. Written plainly, a list of string literals.
   */
  readonly related?: readonly string[];
  /**
   * Other words the catalogue's search finds the component by, besides its name and title: the names other libraries
   * give it (`["horizontal", "row", "hstack"]` for `Inline`). Written plainly, a list of string literals.
   */
  readonly keywords?: readonly string[];
  /** Settings for every story of the file. */
  readonly parameters?: StoryParameters;
  /** Wrappers for every story of the file, outermost last. */
  readonly decorators?: readonly Decorator<TRenderer, TArgs>[];
  /** What every story of the file renders when it writes no render of its own. */
  readonly render?: (args: TArgs, context: StoryContext<TArgs>) => TRenderer["storyResult"];
  /** The play function of every story of the file that writes none of its own. */
  readonly play?: (context: StoryPlayContext<TArgs>) => Promise<void> | void;
  /** Loaders for every story of the file, after the preview's. */
  readonly loaders?: OneOrMany<StoryLoader<TArgs>>;
  /** Set-ups for every story of the file, after the preview's. */
  readonly beforeEach?: OneOrMany<StoryBeforeEach<TArgs>>;
  /** Tags of every story of the file (`["autodocs"]`); a story's `!name` takes one away. Written plainly. */
  readonly tags?: readonly string[];
  /** The named exports that are stories: a list of names or a regular expression; every one by default. */
  readonly includeStories?: readonly string[] | RegExp;
  /** The named exports that are not stories (shared data): a list of names or a regular expression. */
  readonly excludeStories?: readonly string[] | RegExp;
};

/** A story, a named export of a story file, for a framework: its args as in `CsfMeta`. */
export type CsfStory<TRenderer extends Renderer, TArgs, TWrittenArgs> = {
  /** The name in the catalogue; by default the export's name in sentence case (`KeyboardOpen` → "Keyboard open"). */
  readonly name?: string;
  /** Args over the meta's. */
  readonly args?: TWrittenArgs;
  /** How the props panel shows the args (Storybook's `argTypes`). */
  readonly argTypes?: ArgTypes<TWrittenArgs>;
  /**
   * The catalogue's switches the story fixes, by the switch's id (`{ theme: "dark" }`), and Storybook's
   * `backgrounds` and `viewport` (`{ backgrounds: { value: "dark" } }`): drawn so whatever the toolbar says, which
   * shows them as set by the story.
   */
  readonly globals?: Readonly<Record<string, unknown>>;
  /** What the story renders; by default the meta's component with the args. */
  readonly render?: (args: TArgs, context: StoryContext<TArgs>) => TRenderer["storyResult"];
  /** Runs after the story renders: a keyboard flow, an async path (the tests run it too). */
  readonly play?: (context: StoryPlayContext<TArgs>) => Promise<void> | void;
  /** Settings over the meta's. */
  readonly parameters?: StoryParameters;
  /** Wrappers inside the meta's. */
  readonly decorators?: readonly Decorator<TRenderer, TArgs>[];
  /** Loaders after the meta's. */
  readonly loaders?: OneOrMany<StoryLoader<TArgs>>;
  /** Set-ups after the meta's. */
  readonly beforeEach?: OneOrMany<StoryBeforeEach<TArgs>>;
  /** Tags over the meta's: `!name` takes one of the meta's away. Written plainly. */
  readonly tags?: readonly string[];
};

/**
 * A catalogue's preview (`forgebook.preview.ts`), for a framework: what applies to every story in the frames. Its
 * decorators wrap every story outside the meta's and the story's own (a provider, the language's provider reading
 * `context.globals.lang`), its parameters sit under every meta's, its setup runs once before any story renders, and
 * its loaders and set-ups run before every story's own.
 */
export type CsfPreview<TRenderer extends Renderer> = {
  /** Wrappers for every story, outermost last. */
  readonly decorators?: readonly Decorator<TRenderer, Readonly<Record<string, unknown>>>[];
  /** Settings every story starts from, under its meta's and its own. */
  readonly parameters?: StoryParameters;
  /** What the stories need before any renders (a polyfill to load); nothing by default. */
  readonly setup?: () => Promise<void>;
  /** Loaders for every story, before the meta's and the story's. */
  readonly loaders?: OneOrMany<StoryLoader<Readonly<Record<string, unknown>>>>;
  /** Set-ups for every story, before the meta's and the story's. */
  readonly beforeEach?: OneOrMany<StoryBeforeEach<Readonly<Record<string, unknown>>>>;
  /** Args every story starts from, under its meta's (Storybook's project args). */
  readonly args?: Readonly<Record<string, unknown>>;
  /** How the props panel shows args of every story, under the meta's and the story's. */
  readonly argTypes?: Readonly<Record<string, ArgType>>;
  /**
   * Storybook's toolbar of the preview's own globals: read by the configuration on Node, through
   * `switchesFromGlobalTypes`, never by the frames.
   */
  readonly globalTypes?: Readonly<Record<string, unknown>>;
  /** The globals' first values, for `switchesFromGlobalTypes`. */
  readonly initialGlobals?: Readonly<Record<string, unknown>>;
  /** Tags of every story, under the meta's. */
  readonly tags?: readonly string[];
};
