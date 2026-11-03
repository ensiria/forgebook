/**
 * The plugin API: what a package gives a catalogue. Version 1 of a public contract; `PLUGINS.md` beside the package's
 * README states it, with what it leaves out.
 *
 * @remarks
 * A plugin is plain data, read on Node from the configuration's `plugins`: everything that runs in a page is a module
 * it names, so a catalogue that lists none has nothing to load, and a tab's code loads the first time the tab opens.
 * There are four places to add to, and no other: a panel tab, a switch of the toolbar and the View menu, a block of a
 * docs page, and what runs around a story in its frame.
 *
 * A view (a tab, a block) is handed an element and draws in it with whatever it likes. The contract never names React:
 * the shell's own components, hooks and state stay free to change, and `forgebook/plugin-react` is the few lines a
 * React view needs. Everything a view may read arrives in its context; the messages between the shell and the frames
 * stay private, so a plugin reaches its frame module through `report` alone.
 *
 * Runs on Node and in both pages: this module imports nothing of either.
 *
 * @module
 */
import type { FigmaLink } from "@forgebook/story-format/source";

import type { LoadedBeforeEach, LoadedDecorator } from "./frame/storyModule.ts";
import type { ViewSwitch } from "./switches.ts";

/**
 * A version of this contract. A plugin writes the number itself, not a constant of this package: a constant would read
 * as whichever Forgebook is installed, and no plugin could ever be refused.
 */
export type PluginApiVersion = 1;

/** A value that crosses between a frame and the shell, and stays what it was: JSON. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/**
 * When a tab is offered. `parameter` is known once the story's frame ran, so such a tab comes in then, and not at all
 * for a story that fails before it. `design` is known at once: the index reads it, and offers the tab only for a link
 * that passed its check.
 */
export type PluginCondition =
  | {
      /** The story's parameter, a top-level name (`msw`). */
      readonly parameter: string;
    }
  | {
      /** The design tool the story must have a link to. */
      readonly design: "figma";
    };

/** A panel tab. */
export type PluginTab = {
  /**
   * Its id, in the address (`?tab=figma`) and in the catalogue's `tabs`: the plugin's id, or that and a hyphen and a
   * word, so no later tab of Forgebook's or another plugin's can take it.
   */
  readonly id: string;
  /** Its name, in English; a catalogue replaces it as any tab's (`strings: { "tabs.figma": "…" }`). */
  readonly label: string;
  /** The module that draws it, as a specifier the catalogue's folder resolves: it exports a `PluginView` as `view`. */
  readonly view: string;
  /** When it is offered; for every story by default. */
  readonly when?: PluginCondition;
};

/** A block of a docs page, written as a fenced block named after it, at the page's top level. */
export type PluginDocBlock = {
  /** The fence's name, which a page writes after its opening backticks: named as a tab's id is. */
  readonly fence: string;
  /** The module that draws it, as a specifier the catalogue's folder resolves: it exports a `PluginView` as `view`. */
  readonly view: string;
};

/** A switch a plugin adds: a catalogue's, without the roles the catalogue itself reads, which stay the catalogue's. */
export type PluginSwitch = Omit<ViewSwitch, "role">;

/** What a package gives a catalogue. */
export type ForgebookPlugin = {
  /** The contract it is written for: the number, written out. */
  readonly apiVersion: PluginApiVersion;
  /** Its id (`figma`), lower-case words and hyphens: it starts the ids of what it adds, and names its texts. */
  readonly id: string;
  /** The tabs it adds to the panel, after Code and before Accessibility, in the order of `plugins`. */
  readonly tabs?: readonly PluginTab[];
  /** The switches it adds, after the catalogue's own, each id named as a tab's is. */
  readonly switches?: readonly PluginSwitch[];
  /** The blocks it adds to docs pages. */
  readonly docBlocks?: readonly PluginDocBlock[];
  /**
   * The module that runs in every frame, as a specifier the catalogue's folder resolves: it exports what
   * `definePluginFrame` makes as `frame`. One module for every framework, or one per framework by the adapter's name
   * (`{ react: "…" }`), since what a decorator returns is the framework's; a catalogue of another framework refuses the
   * plugin. It loads with every story, so a heavy tool is imported inside its `prepare`.
   */
  readonly frame?: string | Readonly<Record<string, string>>;
  /** The packages its modules import in the browser: pre-bundled, and a catalogue without one is told at once. */
  readonly browserDependencies?: readonly string[];
};

/** What every view is told. */
export type PluginViewContext = {
  /** The shell's appearance now: a view that follows it draws itself again on `update`. */
  readonly appearance: "light" | "dark";
  /**
   * A text the view shows: the catalogue's replacement (`strings: { "plugin.figma.compare": "…" }`), or the English
   * given, with `{name}` replaced by its value. The same function for the view's whole life.
   *
   * @param key - the text's name within the plugin (`compare`).
   * @param fallback - the text in English.
   * @param values - what its `{name}`s stand for.
   */
  readonly text: (key: string, fallback: string, values?: Readonly<Record<string, string>>) => string;
};

/** The story a tab is shown for. */
export type PluginStory = {
  /** The story's id (`kit:inputs-select--overview`). */
  readonly id: string;
  /** The story's name. */
  readonly name: string;
  /** The component's title, its place in the sidebar. */
  readonly title: string;
  /** The component's name. */
  readonly componentName: string;
  /** Its design, by tool: only a link that passed the check. */
  readonly design: {
    /** Its node or file in Figma. */
    readonly figma?: FigmaLink;
  };
};

/** A story's second frame, drawn in an element of a view. */
export type PluginStoryFrame = {
  /** Takes it away. */
  readonly remove: () => void;
};

/** What a tab is told. */
export type PluginTabContext = PluginViewContext & {
  /** The story shown. A view lives for one story: another story mounts it anew. */
  readonly story: PluginStory;
  /**
   * The last value the plugin's frame module reported for this story; none before it reported, and none in the
   * compare view, where no frame is the story's.
   */
  readonly report: JsonValue | undefined;
  /**
   * Draws the story again in an element of the view, at the stage's width, with the panel's values and the view of
   * this moment; a second frame, which tells the stage nothing. The same function for the view's whole life.
   *
   * @param target - the element.
   * @param options - the frame's accessible name.
   */
  readonly showStory: (
    target: HTMLElement,
    options: {
      /** The frame's accessible name. */
      readonly title: string;
    }
  ) => PluginStoryFrame;
};

/** What a docs block is told. */
export type PluginDocBlockContext = PluginViewContext & {
  /** What the fence's line says after the block's name. */
  readonly argument: string;
  /** The text inside the fence. */
  readonly body: string;
  /**
   * Draws a story in an element of the block, in the page's view. The same function for the view's whole life.
   *
   * @param target - the element.
   * @param options - the frame's accessible name, and the story.
   * @throws when the catalogue has no such story.
   */
  readonly showStory: (
    target: HTMLElement,
    options: {
      /** The frame's accessible name. */
      readonly title: string;
      /** The story's id. */
      readonly storyId: string;
    }
  ) => PluginStoryFrame;
};

/** A view that is drawing, as the shell keeps it. */
export type PluginViewHandle<TContext extends PluginViewContext> = {
  /** Draws it again with a new context. */
  readonly update: (context: TContext) => void;
  /** Takes it away from its element. */
  readonly unmount: () => void;
};

/**
 * A tab or a docs block: the `view` export of the module its declaration names.
 *
 * @param target - the element it draws in, which it owns; it has no box of its own (`display: contents`).
 * @param context - what it is told.
 * @returns what the shell keeps of it.
 */
export type PluginView<TContext extends PluginViewContext> = (
  target: HTMLElement,
  context: TContext
) => PluginViewHandle<TContext>;

/** What goes with a report. */
export type PluginReportOptions = {
  /** A short note beside a tab's name (a count); none shows nothing. */
  readonly hint?: string;
  /** The tab the note is for, by id; the plugin's first by default. */
  readonly tab?: string;
};

/** What a plugin's frame module is given. */
export type PluginFrameHost = {
  /**
   * Tells the plugin's tabs about this story. The value replaces the last one, so it holds all they need (a log is sent
   * whole, kept short).
   *
   * @param value - what a tab receives as `report`.
   * @param options - a note beside a tab's name.
   */
  readonly report: (value: JsonValue, options?: PluginReportOptions) => void;
};

/** What `prepare` is told: the context of a CSF `beforeEach`. */
export type PluginPrepareContext = Parameters<LoadedBeforeEach>[0];

/** What a plugin runs around a story, in its frame. */
export type PluginFrame = {
  /** Wrap every story, outside the catalogue's own. What one returns is the framework's. */
  readonly decorators?: readonly LoadedDecorator[];
  /**
   * Runs before every mount, ahead of the story's loaders, with the context of a CSF `beforeEach`; what it returns runs
   * when the story is mounted again or left, and the next mount waits for it, two seconds at most. What it throws
   * is shown as the story's error.
   */
  readonly prepare?: LoadedBeforeEach;
};

/**
 * The `frame` export of a plugin's frame module, called once per frame. What it throws is shown in place of the story,
 * in every frame.
 *
 * @param host - how it reaches its tabs.
 * @returns what it runs around the story.
 */
export type CreatePluginFrame = (host: PluginFrameHost) => PluginFrame;

/**
 * A plugin, typed: what a plugin package's main export returns.
 *
 * @param plugin - the plugin.
 */
export const definePlugin = (plugin: ForgebookPlugin): ForgebookPlugin => plugin;

/**
 * A plugin's frame module, typed.
 *
 * @param create - makes what runs around the story, once per frame.
 */
export const definePluginFrame = (create: CreatePluginFrame): CreatePluginFrame => create;
