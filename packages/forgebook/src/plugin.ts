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
import type { FigmaLink } from "./figmaLink.ts";
import type { LoadedBeforeEach, LoadedDecorator } from "./frame/storyModule.ts";
import type { ViewSwitch } from "./switches.ts";

/** The version of this contract. A breaking change raises it; adding an optional field does not. */
export const PLUGIN_API_VERSION = 1;

/** A version of the contract. */
export type PluginApiVersion = typeof PLUGIN_API_VERSION;

/** A value that crosses between a frame and the shell, and stays what it was: JSON. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** When a tab is offered: for a story with this parameter. */
export type PluginCondition = {
  /**
   * The story's parameter, a top-level name (`msw`): known once its frame ran. `design` is known at once, since the
   * index reads it.
   */
  readonly parameter: string;
};

/** A panel tab. */
export type PluginTab = {
  /** Its id, in the address (`?tab=design`) and in the catalogue's `tabs`: unique, and none of Forgebook's. */
  readonly id: string;
  /** Its name, in English; a catalogue replaces it as any tab's (`strings: { "tabs.design": "…" }`). */
  readonly label: string;
  /** The module that draws it, as a specifier the catalogue's folder resolves: it exports a `PluginView` as `view`. */
  readonly view: string;
  /** When it is offered; for every story by default. */
  readonly when?: PluginCondition;
};

/**
 * A block of a docs page, written as a fenced block named after it.
 *
 * @remarks
 * Declared and checked today; drawn once docs pages are in the shell, which is the only thing that exercises it.
 */
export type PluginDocBlock = {
  /** The fence's name, which a page writes after its opening backticks: unique, and neither `story` nor `props`. */
  readonly fence: string;
  /** The module that draws it, as a specifier the catalogue's folder resolves: it exports a `PluginView` as `view`. */
  readonly view: string;
};

/** What a package gives a catalogue. */
export type ForgebookPlugin = {
  /** The contract it is written for: `PLUGIN_API_VERSION`. */
  readonly apiVersion: PluginApiVersion;
  /** Its id (`figma`), lower-case words and hyphens: names its messages and its texts (`plugin.figma.…`). */
  readonly id: string;
  /** The tabs it adds to the panel, after Code and before Accessibility, in the order of `plugins`. */
  readonly tabs?: readonly PluginTab[];
  /** The switches it adds, after the catalogue's own; a switch the catalogue declares with the same id wins. */
  readonly switches?: readonly ViewSwitch[];
  /** The blocks it adds to docs pages. */
  readonly docBlocks?: readonly PluginDocBlock[];
  /**
   * The module that runs in every frame, as a specifier the catalogue's folder resolves: it exports what
   * `definePluginFrame` makes as `frame`. It loads with every story, so a heavy tool is imported inside its `prepare`.
   */
  readonly frame?: string;
  /** The frameworks its frame module works with, by the adapter's name (`react`): every one by default. */
  readonly frameworks?: readonly string[];
  /** The packages its modules import in the browser: pre-bundled, so a page never reloads to find them. */
  readonly browserDependencies?: readonly string[];
};

/** What every view is told. */
export type PluginViewContext = {
  /** The contract the shell speaks. */
  readonly apiVersion: PluginApiVersion;
  /** The shell's appearance now: a view that follows it draws itself again on `update`. */
  readonly appearance: "light" | "dark";
  /**
   * A text the view shows: the catalogue's replacement (`strings: { "plugin.figma.compare": "…" }`), or the English
   * given.
   *
   * @param key - the text's name within the plugin (`compare`).
   * @param fallback - the text in English.
   */
  readonly text: (key: string, fallback: string) => string;
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
  /** Whether the story is about logic: a hook's, with no look of its own. */
  readonly isLogic: boolean;
  /** Its design (`parameters.design.figma`), checked; none without one. */
  readonly design: FigmaLink | undefined;
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
   * this moment; a story's second frame, which reports nothing to the stage.
   *
   * @param target - the element.
   * @param title - the frame's accessible name.
   * @returns what takes the frame away.
   */
  readonly showStory: (target: HTMLElement, title: string) => () => void;
};

/** What a docs block is told. */
export type PluginDocBlockContext = PluginViewContext & {
  /** What the fence's line says after the block's name. */
  readonly argument: string;
  /** The text inside the fence. */
  readonly body: string;
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
 * @param target - the element it draws in, which it owns.
 * @param context - what it is told.
 * @returns what the shell keeps of it.
 */
export type PluginView<TContext extends PluginViewContext> = (
  target: HTMLElement,
  context: TContext
) => PluginViewHandle<TContext>;

/** What a plugin's frame module is given. */
export type PluginFrameHost = {
  /** The contract the frame speaks. */
  readonly apiVersion: PluginApiVersion;
  /**
   * Tells the plugin's tab about this story. The value replaces the last one, so it holds all the tab needs (a log is
   * sent whole, kept short).
   *
   * @param value - what the tab receives as `report`.
   * @param hint - a short note beside the tab's name (a count); none shows nothing.
   */
  readonly report: (value: JsonValue, hint?: string) => void;
};

/** What `prepare` is told: the context of a CSF `beforeEach`. */
export type PluginPrepareContext = Parameters<LoadedBeforeEach>[0];

/** What a plugin runs around a story, in its frame. */
export type PluginFrame = {
  /**
   * Wrap every story, outside the catalogue's own. What one returns is the framework's, so a plugin with decorators
   * names its `frameworks`.
   */
  readonly decorators?: readonly LoadedDecorator[];
  /**
   * Runs before every mount, ahead of the story's loaders, with the context of a CSF `beforeEach`; what it returns runs
   * when the story is mounted again or left. What it throws is shown as the story's error.
   */
  readonly prepare?: LoadedBeforeEach;
};

/**
 * The `frame` export of a plugin's frame module.
 *
 * @param host - how it reaches its tab.
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
