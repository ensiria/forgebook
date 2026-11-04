/**
 * The plugins' tabs of a story's panel, with their code loaded only by a catalogue that lists a plugin: the shell's first
 * load holds none of it, a catalogue without one ships none of it (`pluginHostsContext.ts`), and a listed plugin's tabs
 * come in a moment after the panel.
 *
 * @module
 */
import { useEffect, useMemo, useState } from "react";

import type { PluginStory } from "../plugin.ts";
import type { TreeComponent, TreeStory } from "../storyTree.ts";
import type { DockTab } from "./Dock.tsx";
import { MISSING_PLUGIN_HOSTS, usePluginHosts } from "./pluginHostsContext.ts";
import type { PluginTabsInput } from "./pluginTabs.tsx";

/** What builds the tabs. */
type BuildTabs = (input: PluginTabsInput) => DockTab[];

/**
 * The tabs the story has something for.
 *
 * @param input - the plugins, the story and what it reported.
 * @returns the tabs; none until their code is there.
 */
export const usePluginTabs = (input: PluginTabsInput): readonly DockTab[] => {
  const [build, setBuild] = useState<{ readonly tabs: BuildTabs } | undefined>(undefined);
  const loadHosts = usePluginHosts();
  const hasPlugins = input.plugins.length > 0;
  useEffect(() => {
    if (!hasPlugins) return;
    if (loadHosts === undefined) {
      window.reportError(new Error(MISSING_PLUGIN_HOSTS));
      return;
    }
    void loadHosts()
      .then((hosts) => setBuild({ tabs: hosts.tabsFor }))
      .catch((error: unknown) => window.reportError(error));
  }, [hasPlugins, loadHosts]);
  return build?.tabs(input) ?? [];
};

/**
 * The story as a plugin's tab is told it, kept while the story stays.
 *
 * @param component - the story's component.
 * @param story - the story.
 */
export const usePluginStory = (component: TreeComponent, story: TreeStory): PluginStory =>
  useMemo(
    (): PluginStory => ({
      id: story.id,
      name: story.name,
      title: component.title,
      componentName: component.name,
      design: story.design === undefined ? {} : { figma: story.design }
    }),
    [story, component]
  );
