/**
 * The catalogue's settings, as the shell's components read them: its switches and its lists (`catalogue.ts`),
 * computed once from the configuration, so the toolbar, the stage, the compare view and the pages agree.
 *
 * @module
 */
import type { StoryLanguage } from "@forgebook/story-format/source";
import { createContext, useContext, useMemo } from "react";

import { type CatalogueLists, type CatalogueSettings, catalogueSettings } from "../catalogue.ts";
import { catalogueSwitches, DEFAULT_SWITCHES, type ViewSwitch } from "../switches.ts";
import type { ShellPlugin } from "./pluginTabs.tsx";

/** The catalogue's settings; the defaults until the shell provides its own. */
export const CatalogueContext = createContext<CatalogueSettings>(catalogueSettings("", DEFAULT_SWITCHES));

/** The catalogue's settings. */
export const useCatalogue = (): CatalogueSettings => useContext(CatalogueContext);

/** No plugins: a catalogue that lists none. */
const NO_PLUGINS: readonly ShellPlugin[] = [];

/** No languages: a catalogue that offers none. */
const NO_LANGUAGES: readonly StoryLanguage[] = [];

/**
 * The catalogue's settings computed once from its configuration, for the page that provides them.
 *
 * @param config - its name, its switches, its languages and its lists.
 */
export const useConfiguredCatalogue = ({
  title,
  switches,
  languages = NO_LANGUAGES,
  lists,
  plugins = NO_PLUGINS
}: {
  readonly title: string;
  readonly switches?: readonly ViewSwitch[];
  readonly languages?: readonly StoryLanguage[];
  readonly lists?: CatalogueLists;
  readonly plugins?: readonly ShellPlugin[];
}): CatalogueSettings =>
  useMemo(
    () =>
      catalogueSettings(
        title,
        catalogueSwitches(switches, languages, lists?.controls),
        lists,
        plugins.flatMap((plugin) => plugin.tabs.map((tab) => tab.id))
      ),
    [title, switches, languages, lists, plugins]
  );
