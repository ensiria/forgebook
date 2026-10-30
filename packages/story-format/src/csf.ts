/**
 * The story format: Component Story Format 3, the subset the Ensiria catalogue reads.
 *
 * @remarks
 * A story file exports its meta as the default export and each story as a named export, as CSF requires, so
 * Storybook or Ladle could read the same files (D-54). The types cover only what the catalogue reads; anything else
 * in a story file is left alone. The format is its own package so the packages that write stories depend on it, not
 * on the catalogue that shows them. Parameters the catalogue adds (`forceState`, `replay`) sit under `parameters`, where CSF
 * keeps tool-specific settings.
 * A Live story (`parameters.clock`) reads the story clock the catalogue runs (`./clock`, D-504).
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

import type { StoryClock, StoryClockSetting } from "./clock";
import type { StoryTextArg, StoryTextFunction } from "./texts";

/**
 * A framework, as the story types read it: what a meta names as its component, and what a render, a decorator and a
 * language's provider return.
 */
export type Renderer = {
  /** A component of the framework. */
  readonly component: unknown;
  /** What a story draws (`ReactNode` in React). */
  readonly storyResult: unknown;
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

/**
 * The groups a component's stories fall into in the sidebar, in their order: the kinds of story a component page
 * has. A story without a group (the Overview, one value) sits above them.
 */
export const STORY_GROUPS = [
  "states",
  "motion",
  "in-context",
  "showcase",
  "worst-case",
  "behaviour"
] as const;

/** A group of stories in the sidebar. */
export type StoryGroup = (typeof STORY_GROUPS)[number];

/** The settings the catalogue reads from a meta or a story; anything else under `parameters` is left alone. */
export type StoryParameters = {
  /** The states forced on the whole story; a part can force its own with `data-forgebook-force`. */
  readonly forceState?: ForcedState | readonly ForcedState[];
  /** Shows the Replay control and says what it does. */
  readonly replay?: ReplayMode;
  /**
   * The props the panel can set for the story: every adjustable prop by default, only the listed ones, or none
   * (`false`) for a story that draws fixed examples and ignores its args, which then shows no props (its column stays, empty, so the story keeps its width). With a list, the
   * others are listed without a control.
   */
  readonly controls?: false | readonly string[];
  /** The story's group in the sidebar, written plainly (the index reads it); none puts it above the groups. */
  readonly group?: StoryGroup;
  /**
   * Whether the story is the component's demo, drawn at the top of its page: one real, well-made use of it, not a
   * matrix of its values. Written plainly (`main: true`, the index reads it); without one, the page shows `Overview`.
   */
  readonly main?: boolean;
  /**
   * The height the story's scene needs, in CSS px: the frame has it from the start, so an overlay the story opens is
   * placed once, as in a window of that size, instead of flipping or scrolling in a frame only as tall as the story's
   * own content. The frame still grows past it with its content (D-469). Written plainly (`height: 320`, the index
   * reads it).
   */
  readonly height?: number;
  /**
   * The story reads the story clock (`context.clock`, `useStoryNow`): a Live story, which starts at this moment and
   * then runs; the catalogue shows pause, resume, restart and the speed, and the tests hold it at its start (D-504).
   * None by default: the clock is held at the Unix epoch and the catalogue shows no clock controls.
   */
  readonly clock?: StoryClockSetting;
  /** How the story sits in its frame: padded (default), centred, or the whole frame. */
  readonly layout?: "padded" | "centered" | "fullscreen";
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
   * the Unix epoch when the story declares no `parameters.clock` (D-504).
   */
  readonly clock: StoryClock;
  /**
   * The values of the catalogue's switches applied by code, by the switch's id (CSF's name): what a decorator reads
   * to pick a provider's theme, a density, a locale. Empty outside a catalogue.
   */
  readonly globals: Readonly<Record<string, string>>;
};

/** Wraps a story: a provider, a container of a given width. */
export type Decorator<TRenderer extends Renderer, TArgs> = (
  story: () => TRenderer["storyResult"],
  context: StoryContext<TArgs>
) => TRenderer["storyResult"];

/**
 * A story file's default export, for a framework: `TComponent` is the component it shows, `TArgs` what its render
 * receives and `TWrittenArgs` what its args may write (a framework's package derives both from the component's props).
 */
export type CsfMeta<TRenderer extends Renderer, TComponent, TArgs, TWrittenArgs> = {
  /** Where it sits in the catalogue: `Family/Name` or `Family/Group/Name` (`Inputs/Selection/Select`). */
  readonly title: string;
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
  /**
   * Other places the catalogue lists the component in, besides its title's, as `Family` or `Family/Group`
   * (`["Data/Tables"]`): a component that belongs to one family but is looked for in another. Each place shows an
   * entry marked as living elsewhere that opens the same page, so nothing is duplicated: no second story, test or
   * image (D-492). Written plainly, a list of string literals: the catalogue reads it without running the file.
   */
  readonly alsoIn?: readonly string[];
  /**
   * The titles of related components of the same source (`["Layout/Inline"]`): each page names the other at its top,
   * both ways, so writing the link in one meta is enough (D-492). Written plainly, a list of string literals.
   */
  readonly related?: readonly string[];
  /**
   * Other words the catalogue's search finds the component by, besides its name and title: the names other libraries
   * give it (`["horizontal", "row", "hstack"]` for `Inline`). Written plainly, a list of string literals (D-603).
   */
  readonly keywords?: readonly string[];
  /** Settings for every story of the file. */
  readonly parameters?: StoryParameters;
  /** Wrappers for every story of the file, outermost last. */
  readonly decorators?: readonly Decorator<TRenderer, TArgs>[];
};

/** A story, a named export of a story file, for a framework: its args as in `CsfMeta`. */
export type CsfStory<TRenderer extends Renderer, TArgs, TWrittenArgs> = {
  /** The name in the catalogue; by default the export's name in sentence case (`KeyboardOpen` → "Keyboard open"). */
  readonly name?: string;
  /** Args over the meta's. */
  readonly args?: TWrittenArgs;
  /** What the story renders; by default the meta's component with the args. */
  readonly render?: (args: TArgs, context: StoryContext<TArgs>) => TRenderer["storyResult"];
  /** Runs after the story renders: a keyboard flow, an async path (the tests run it too). */
  readonly play?: (context: StoryContext<TArgs>) => Promise<void> | void;
  /** Settings over the meta's. */
  readonly parameters?: StoryParameters;
  /** Wrappers inside the meta's. */
  readonly decorators?: readonly Decorator<TRenderer, TArgs>[];
};
