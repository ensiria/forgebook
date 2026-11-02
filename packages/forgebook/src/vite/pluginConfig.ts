/**
 * The plugins a configuration lists, checked on Node before anything is generated from them, and what they add to it.
 *
 * @remarks
 * A configuration is code nobody type-checked against this version, and what it names ends up in generated imports and
 * in the address, so every plugin is read as `unknown`-shaped data here: one whose contract this Forgebook does not
 * speak, or that collides with another or with Forgebook itself, stops the catalogue with a message that names it,
 * rather than breaking a page later.
 *
 * @module
 */
import { PANEL_TAB_IDS } from "../catalogue.ts";
import { type ForgebookPlugin, PLUGIN_API_VERSION } from "../plugin.ts";
import { DEFAULT_SWITCHES, type ViewSwitch } from "../switches.ts";
import type { PluginsDocument } from "./agent.types.ts";

/** A plugin's id, a tab's id or a block's fence: lower-case words and hyphens. */
const NAME = /^[a-z][a-z0-9-]*$/;

/** The fences a docs page already reads. */
const OWN_FENCES = ["story", "props"];

/**
 * The first of some names that is there twice, or not a name.
 *
 * @param names - the names.
 * @param isTaken - whether a name is Forgebook's own.
 * @param what - what a name names, for the message.
 */
const namesProblem = (
  names: readonly string[],
  isTaken: (name: string) => boolean,
  what: string
): string | undefined => {
  const seen = new Set<string>();
  for (const name of names) {
    if (!NAME.test(name)) return `${what} "${name}" must be lower-case words and hyphens`;
    if (isTaken(name)) return `${what} "${name}" is Forgebook's own`;
    if (seen.has(name)) return `${what} "${name}" is given twice`;
    seen.add(name);
  }
  return undefined;
};

/**
 * Why one plugin cannot be used, or none.
 *
 * @param plugin - the plugin.
 * @param framework - the catalogue's framework.
 */
const pluginProblem = (plugin: ForgebookPlugin, framework: string): string | undefined => {
  if (plugin.apiVersion !== PLUGIN_API_VERSION) {
    return (
      `the plugin "${plugin.id}" is written for version ${String(plugin.apiVersion)} of the plugin API, and this ` +
      `Forgebook speaks version ${PLUGIN_API_VERSION}: update one of them`
    );
  }
  const modules = [
    ...(plugin.tabs ?? []).map((tab) => tab.view),
    ...(plugin.docBlocks ?? []).map((block) => block.view),
    ...(plugin.frame === undefined ? [] : [plugin.frame])
  ];
  if (modules.some((module) => typeof module !== "string" || module === ""))
    return `the plugin "${plugin.id}" names a module that is no specifier`;
  if (plugin.frame !== undefined && plugin.frameworks?.includes(framework) === false) {
    return `the plugin "${plugin.id}" runs in frames of ${plugin.frameworks.join(", ")}, and this catalogue is ${framework}`;
  }
  return undefined;
};

/**
 * Why a list of plugins cannot be used, or none.
 *
 * @param plugins - the configuration's plugins.
 * @param framework - the catalogue's framework.
 */
export const pluginsProblem = (
  plugins: readonly ForgebookPlugin[],
  framework: string
): string | undefined => {
  const never = (): boolean => false;
  const isOwnTab = (id: string): boolean => PANEL_TAB_IDS.some((own) => own === id);
  return (
    namesProblem(
      plugins.map((plugin) => String(plugin.id)),
      never,
      "the plugin"
    ) ??
    plugins.map((plugin) => pluginProblem(plugin, framework)).find((problem) => problem !== undefined) ??
    namesProblem(
      plugins.flatMap((plugin) => plugin.tabs ?? []).map((tab) => tab.id),
      isOwnTab,
      "the tab"
    ) ??
    namesProblem(
      plugins.flatMap((plugin) => plugin.docBlocks ?? []).map((block) => block.fence),
      (fence: string): boolean => OWN_FENCES.includes(fence),
      "the docs block"
    )
  );
};

/**
 * The catalogue's switches with the plugins' after them: a plugin adds to the catalogue's and never takes the place of
 * the theme and the contrast it would have by default. The catalogue's own switch of the same id wins.
 *
 * @param switches - the catalogue's, merged with its presets'; none when neither declares any.
 * @param plugins - the plugins.
 */
export const withPluginSwitches = (
  switches: readonly ViewSwitch[] | undefined,
  plugins: readonly ForgebookPlugin[]
): readonly ViewSwitch[] | undefined => {
  const added = plugins.flatMap((plugin) => plugin.switches ?? []);
  if (added.length === 0) return switches;
  const own = switches ?? DEFAULT_SWITCHES;
  return [...own, ...added.filter((each) => !own.some((other) => other.id === each.id))];
};

/**
 * Every module of the plugins that pages import, for pre-bundling an installed plugin.
 *
 * @param plugins - the plugins.
 */
export const pluginModules = (plugins: readonly ForgebookPlugin[]): string[] =>
  plugins.flatMap((plugin) => [
    ...(plugin.tabs ?? []).map((tab) => tab.view),
    ...(plugin.frame === undefined ? [] : [plugin.frame])
  ]);

/**
 * The plugins as tools and agents read them.
 *
 * @param plugins - the plugins.
 */
export const pluginsDocument = (plugins: readonly ForgebookPlugin[]): PluginsDocument => ({
  schema: 1,
  apiVersion: PLUGIN_API_VERSION,
  plugins: plugins.map((plugin) => ({
    id: plugin.id,
    tabs: (plugin.tabs ?? []).map((tab) => ({
      id: tab.id,
      label: tab.label,
      ...(tab.when === undefined ? {} : { parameter: tab.when.parameter })
    })),
    switches: (plugin.switches ?? []).map((each) => each.id),
    docBlocks: (plugin.docBlocks ?? []).map((block) => block.fence),
    runsInFrames: plugin.frame !== undefined
  }))
});
