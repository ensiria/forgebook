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
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

import { PANEL_TAB_IDS } from "../catalogue.ts";
import type { ForgebookPlugin, PluginSwitch } from "../plugin.ts";
import { DEFAULT_SWITCHES, type ViewSwitch } from "../switches.ts";
import type { PluginsDocument } from "./agent.types.ts";

/** The versions of the contract this Forgebook speaks. */
export const SUPPORTED_PLUGIN_API_VERSIONS: readonly number[] = [1];

/** A plugin's id: lower-case words and hyphens. */
const NAME = /^[a-z][a-z0-9-]*$/;

/**
 * The first of some names that is there twice, or not one of the plugin's.
 *
 * @param plugin - the plugin's id.
 * @param names - the names.
 * @param seen - the names of every plugin so far.
 * @param what - what a name names, for the message.
 */
const namesProblem = (
  plugin: string,
  names: readonly string[],
  seen: Set<string>,
  what: string
): string | undefined => {
  for (const name of names) {
    if (name !== plugin && !(name.startsWith(`${plugin}-`) && NAME.test(name)))
      return `${what} "${name}" must be "${plugin}", or start with "${plugin}-"`;
    if (seen.has(name)) return `${what} "${name}" is given twice`;
    seen.add(name);
  }
  return undefined;
};

/**
 * The module a plugin runs in a catalogue's frames, or none.
 *
 * @param plugin - the plugin.
 * @param framework - the catalogue's framework.
 */
export const pluginFrameModule = (plugin: ForgebookPlugin, framework: string): string | undefined =>
  typeof plugin.frame === "object" ? plugin.frame[framework] : plugin.frame;

/** A package's name, from a specifier of it (`@acme/ui/browser` → `@acme/ui`). */
const packageOf = (specifier: string): string =>
  specifier
    .split("/")
    .slice(0, specifier.startsWith("@") ? 2 : 1)
    .join("/");

/**
 * Whether a project installs a package, by its folder: a browser-only package may hide even its manifest from Node.
 *
 * @param dir - the configuration's folder.
 * @param name - the package.
 */
const isPackageInstalled = (dir: string, name: string): boolean =>
  (createRequire(resolve(dir, "package.json")).resolve.paths(name) ?? []).some((folder) =>
    existsSync(join(folder, name))
  );

/**
 * Why one plugin cannot be used, or none.
 *
 * @param plugin - the plugin.
 * @param framework - the catalogue's framework.
 * @param dir - the configuration's folder.
 */
const pluginProblem = (plugin: ForgebookPlugin, framework: string, dir: string): string | undefined => {
  if (!SUPPORTED_PLUGIN_API_VERSIONS.includes(plugin.apiVersion)) {
    return (
      `the plugin "${plugin.id}" is written for version ${String(plugin.apiVersion)} of the plugin API, and this ` +
      `Forgebook speaks version ${SUPPORTED_PLUGIN_API_VERSIONS.join(", ")}: update one of them`
    );
  }
  if (typeof plugin.frame === "object" && plugin.frame[framework] === undefined) {
    const frameworks = Object.keys(plugin.frame).join(", ");
    return `the plugin "${plugin.id}" runs in frames of ${frameworks}, and this catalogue is ${framework}`;
  }
  const modules = [
    ...(plugin.tabs ?? []).map((tab) => tab.view),
    ...(plugin.docBlocks ?? []).map((block) => block.view),
    ...(plugin.frame === undefined ? [] : [pluginFrameModule(plugin, framework)])
  ];
  if (modules.some((module) => typeof module !== "string" || module === ""))
    return `the plugin "${plugin.id}" names a module that is no specifier`;
  const missing = (plugin.browserDependencies ?? [])
    .map(packageOf)
    .find((name) => !isPackageInstalled(dir, name));
  return missing === undefined
    ? undefined
    : `the plugin "${plugin.id}" needs the package ${missing}, which this project does not install`;
};

/**
 * Why a list of plugins cannot be used, or none.
 *
 * @param plugins - the configuration's plugins.
 * @param framework - the catalogue's framework.
 * @param dir - the configuration's folder.
 */
export const pluginsProblem = (
  plugins: readonly ForgebookPlugin[],
  framework: string,
  dir: string
): string | undefined => {
  const ids = new Set<string>();
  const tabs = new Set<string>(PANEL_TAB_IDS);
  const switches = new Set<string>();
  const fences = new Set<string>(["story", "props"]);
  for (const plugin of plugins) {
    const { id } = plugin;
    if (typeof id !== "string" || !NAME.test(id))
      return `the plugin "${String(id)}" must be lower-case words and hyphens`;
    if (ids.has(id)) return `the plugin "${id}" is given twice`;
    ids.add(id);
    const problem =
      pluginProblem(plugin, framework, dir) ??
      namesProblem(
        id,
        (plugin.tabs ?? []).map((tab) => tab.id),
        tabs,
        "the tab"
      ) ??
      namesProblem(
        id,
        (plugin.switches ?? []).map((each) => each.id),
        switches,
        "the switch"
      ) ??
      namesProblem(
        id,
        (plugin.docBlocks ?? []).map((block) => block.fence),
        fences,
        "the docs block"
      );
    if (problem !== undefined) return problem;
  }
  return undefined;
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
  const added: readonly PluginSwitch[] = plugins.flatMap((plugin) => plugin.switches ?? []);
  if (added.length === 0) return switches;
  const own = switches ?? DEFAULT_SWITCHES;
  return [...own, ...added.filter((each) => !own.some((other) => other.id === each.id))];
};

/**
 * Every module of the plugins that pages import, for pre-bundling an installed plugin.
 *
 * @param plugins - the plugins.
 * @param framework - the catalogue's framework.
 */
export const pluginModules = (plugins: readonly ForgebookPlugin[], framework: string): string[] =>
  plugins.flatMap((plugin) => {
    const frame = pluginFrameModule(plugin, framework);
    return [
      ...(plugin.tabs ?? []).map((tab) => tab.view),
      ...(plugin.docBlocks ?? []).map((block) => block.view),
      ...(frame === undefined ? [] : [frame])
    ];
  });

/**
 * The fences the plugins add, for the docs pages' compiler.
 *
 * @param plugins - the plugins.
 */
export const pluginFences = (plugins: readonly ForgebookPlugin[]): readonly string[] =>
  plugins.flatMap((plugin) => (plugin.docBlocks ?? []).map((block) => block.fence));

/**
 * The plugins as tools and agents read them.
 *
 * @param plugins - the plugins.
 */
export const pluginsDocument = (plugins: readonly ForgebookPlugin[]): PluginsDocument => ({
  schema: 1,
  apiVersions: SUPPORTED_PLUGIN_API_VERSIONS,
  plugins: plugins.map((plugin) => ({
    id: plugin.id,
    tabs: (plugin.tabs ?? []).map((tab) => ({
      id: tab.id,
      label: tab.label,
      ...(tab.when === undefined ? {} : { when: tab.when })
    })),
    switches: (plugin.switches ?? []).map((each) => each.id),
    docBlocks: (plugin.docBlocks ?? []).map((block) => block.fence),
    runsInFrames: plugin.frame !== undefined
  }))
});
