/**
 * The plugins' tabs of a story's panel: which ones the story has something for, as the dock lists them.
 *
 * @remarks
 * Whether a tab shows is decided here from data, so a tab never loads to find out; its view loads the first time it
 * opens, and so does its host (`LazyHost`), so a catalogue with no plugin loads only this module.
 *
 * @module
 */
import type { ReactNode } from "react";

import type {
  JsonValue,
  PluginDocBlock,
  PluginDocBlockContext,
  PluginStory,
  PluginTab,
  PluginTabContext,
  PluginView
} from "../plugin.ts";
import type { AsideStory } from "./asideStory.ts";
import type { DockTab } from "./Dock.tsx";
import { LazyHost } from "./LazyHost.tsx";

/** A plugin's tab as the generated page hands it over: its declaration, and the import of its view. */
export type ShellPluginTab = Pick<PluginTab, "id" | "label"> & {
  /** When it is offered; for every story without one. */
  readonly when: PluginTab["when"] | undefined;
  /** Loads the module that draws it. */
  readonly load: () => Promise<{ readonly view: PluginView<PluginTabContext> }>;
};

/** A plugin's docs block as the generated page hands it over. */
export type ShellPluginBlock = Pick<PluginDocBlock, "fence"> & {
  /** Loads the module that draws it. */
  readonly load: () => Promise<{ readonly view: PluginView<PluginDocBlockContext> }>;
};

/** A plugin with views, as the generated page hands it over. */
export type ShellPlugin = {
  /** The plugin's id. */
  readonly id: string;
  /** Its tabs. */
  readonly tabs: readonly ShellPluginTab[];
  /** Its docs blocks. */
  readonly docBlocks: readonly ShellPluginBlock[];
};

/** What a plugin's frame module last said for a story. */
type PluginReport = {
  /** What its tabs receive. */
  readonly value: JsonValue;
  /** The note beside a tab's name; none shows nothing. */
  readonly hint: string | null;
  /** The tab the note is for; none for the plugin's first. */
  readonly tab: string | null;
};

/** The plugins' reports, by `<story>|<plugin>`. */
export type PluginReports = ReadonlyMap<string, PluginReport>;

/** What the plugins' tabs are built from. */
type PluginTabsInput = {
  /** The plugins. */
  readonly plugins: readonly ShellPlugin[];
  /** The texts the catalogue replaces, by name. */
  readonly strings: Readonly<Record<string, string>>;
  /** The story shown. */
  readonly story: PluginStory;
  /** The names of the parameters its frame reported; none before it ran. */
  readonly parameters: readonly string[];
  /** The plugins' reports. */
  readonly reports: PluginReports;
  /** Whether the compare view is shown: its frames each report, and none of them is the story's. */
  readonly isComparing: boolean;
  /** What draws the story again for a tab, with the view's live part. */
  readonly aside: AsideStory;
};

/** Loads the host of a tab. */
const loadHost = async (): Promise<typeof import("./PluginTabHost.tsx").PluginTabHost> =>
  (await import("./PluginTabHost.tsx")).PluginTabHost;

/**
 * Whether a tab is offered for a story.
 *
 * @param tab - the tab.
 * @param story - the story.
 * @param parameters - the names of the parameters its frame reported.
 */
const isOffered = (tab: ShellPluginTab, story: PluginStory, parameters: readonly string[]): boolean => {
  if (tab.when === undefined) return true;
  return "design" in tab.when ? story.design.figma !== undefined : parameters.includes(tab.when.parameter);
};

/**
 * A tab's content: its host, once loaded.
 *
 * @param plugin - the tab's plugin.
 * @param tab - the tab.
 * @param input - what it is told.
 */
const pluginTabContent = (
  plugin: ShellPlugin,
  tab: ShellPluginTab,
  { strings, story, reports, isComparing, aside }: PluginTabsInput
): ReactNode => (
  <LazyHost
    // a view lives for one story: it holds what it drew for it (a viewer's position, a dialog)
    key={`${tab.id}|${story.id}`}
    loadHost={loadHost}
    props={{
      load: tab.load,
      pluginId: plugin.id,
      strings,
      story,
      report: isComparing ? undefined : reports.get(`${story.id}|${plugin.id}`)?.value,
      // the compare view's address already says the whole view
      aside: isComparing ? { ...aside, view: undefined } : aside
    }}
  />
);

/**
 * The note beside a tab's name.
 *
 * @param plugin - the tab's plugin.
 * @param tab - the tab.
 * @param input - the reports.
 */
const hintOf = (plugin: ShellPlugin, tab: ShellPluginTab, input: PluginTabsInput): string | undefined => {
  const report = input.reports.get(`${input.story.id}|${plugin.id}`);
  if (input.isComparing || report === undefined) return undefined;
  return (report.tab ?? plugin.tabs[0]?.id) === tab.id ? (report.hint ?? undefined) : undefined;
};

/**
 * The plugins' tabs the story has something for, in the order of `plugins`.
 *
 * @param input - the plugins, the story and what it reported.
 */
export const pluginTabsFor = (input: PluginTabsInput): DockTab[] =>
  input.plugins.flatMap((plugin) =>
    plugin.tabs
      .filter((tab) => isOffered(tab, input.story, input.parameters))
      .map((tab) => ({
        id: tab.id,
        label: input.strings[`tabs.${tab.id}`] ?? tab.label,
        hint: hintOf(plugin, tab, input),
        content: pluginTabContent(plugin, tab, input)
      }))
  );
