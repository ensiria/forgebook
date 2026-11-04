/**
 * The code that draws the plugins' views: their tabs in a story's panel and their docs blocks. The generated page
 * imports it (`forgebook/shell/plugin-hosts`) only for a catalogue that lists a plugin with views.
 *
 * @module
 */
import type { PluginHosts } from "./pluginHostsContext.ts";
import { pluginTabsFor } from "./pluginTabs.tsx";

/** The plugins' hosts. */
export const pluginHosts: PluginHosts = {
  tabsFor: pluginTabsFor,
  loadBlockHost: async () => (await import("./PluginBlockHost.tsx")).PluginBlockHost
};
