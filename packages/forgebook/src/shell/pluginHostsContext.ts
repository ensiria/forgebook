/**
 * How the shell's parts reach the code that draws the plugins' views: a loader the generated page gives only to a
 * catalogue that lists a plugin with views, so a catalogue without one ships none of that code.
 *
 * @module
 */
import { createContext, useContext } from "react";

import type { PluginBlockHost } from "./PluginBlockHost.tsx";
import type { pluginTabsFor } from "./pluginTabs.tsx";

/** The code that draws the plugins' views (`pluginHosts.ts`). */
export type PluginHosts = {
  /** Builds a story's plugin tabs. */
  readonly tabsFor: typeof pluginTabsFor;
  /** Loads the host of a plugin's docs block, apart: a page with a block need not be a story's page. */
  readonly loadBlockHost: () => Promise<typeof PluginBlockHost>;
};

/** Loads the code that draws the plugins' views. */
export type LoadPluginHosts = () => Promise<PluginHosts>;

/** The loader of the plugins' hosts; none in a catalogue that lists no plugin with views. */
export const PluginHostsContext = createContext<LoadPluginHosts | undefined>(undefined);

/**
 * What a plugin's view reports when the page lists plugins without the code that draws them: a shell configured by
 * hand that left `pluginHosts` out, said rather than drawn as no plugin.
 */
export const MISSING_PLUGIN_HOSTS =
  "The page lists plugins without pluginHosts, the code that draws their views";

/** Reads the loader of the plugins' hosts the page provides; none in a catalogue without a plugin with views. */
export const usePluginHosts = (): LoadPluginHosts | undefined => useContext(PluginHostsContext);
