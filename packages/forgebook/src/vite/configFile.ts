/**
 * A catalogue's configuration file read: found in its folder, loaded, checked, and merged with its presets, as the
 * plugin and the `forgebook` command use it.
 *
 * @remarks
 * Node loads the file with its types stripped (`forgebook.config.ts`, `.mts` or `.js`). A preset's switches,
 * languages and head come before the catalogue's, and a switch or language the catalogue declares with the same id
 * replaces the preset's; its preview sits under the catalogue's. Every problem is named with the file it comes from.
 *
 * @module
 */

import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { StoryDeviceSetting } from "@forgebook/story-format/csf";
import type { StoryLanguage } from "@forgebook/story-format/source";

import { AUDIENCE_IDS } from "../audiences.ts";
import type { CatalogueLists, TurnedOffControl } from "../catalogue.ts";
import { deviceSettingProblem } from "../deviceView.ts";
import type { ForgebookPlugin } from "../plugin.ts";
import { REQUIRED_FIRST_LAYOUTS } from "../propGroups.ts";
import {
  frameThemeCss,
  mergedThemes,
  shellThemeCss,
  shellThemeProblems,
  themeValueProblem
} from "../shellTheme.ts";
import { switchesProblem, type ViewSwitch } from "../switches.ts";
import type { FrameworkAdapter } from "./adapter.ts";
import type { BuildOptions, ForgebookConfig } from "./config.ts";
import { framesProblem, type ResolvedFrames, resolvedFrames } from "./framesConfig.ts";
import { pluginsProblem, withPluginSwitches } from "./pluginConfig.ts";
import { patternsProblem } from "./storyPatterns.ts";
import { tokenThemeOf } from "./themeFromTokens.ts";
import { VITE_PATHS, type VitePaths } from "./vitePaths.ts";

/** The names a configuration file may have, in the order they are looked for. */
export const CONFIG_FILES = ["forgebook.config.ts", "forgebook.config.mts", "forgebook.config.js"];

/**
 * The name the written home has beside the configuration. Prefixed as the preview is, so a `home.md` a project
 * keeps for another reason never replaces the generated home of a catalogue that did not ask for it.
 */
export const HOME_FILE = "forgebook.home.md";

/** The names a preview may have beside the configuration, in the order they are looked for. */
const PREVIEW_FILES = ["forgebook.preview.ts", "forgebook.preview.tsx", "forgebook.preview.js"];

/** The shell's look, ready for its page. */
export type ResolvedShell = {
  /** The theme, as CSS; empty for none. */
  readonly themeCss: string;
  /** What the frames need of the theme, as CSS; empty for none. */
  readonly frameCss: string;
  /** Whether Forgebook's mark stands in for a catalogue without a logo. */
  readonly hasBranding: boolean;
  /** The style sheets it loads after its own, absolute, the presets' first. */
  readonly styleSheets: readonly string[];
  /** What in the theme will not work, for a warning. */
  readonly problems: readonly string[];
};

/** A tokens file, its path absolute. */
export type ResolvedTokensFile = {
  /** The file's absolute path. */
  readonly path: string;
  /** The theme it belongs to; none for the base. */
  readonly mode: string | undefined;
};

/**
 * A configuration ready for the pages: its folder, its presets merged, its paths absolute and in Vite's form (forward
 * slashes on every system, `vitePaths.ts`), so they compare with Vite's ids and can be written into generated code.
 */
export type ResolvedConfig = {
  /** The folder the configuration file is in: Vite's root. */
  readonly dir: string;
  /** The framework. */
  readonly framework: FrameworkAdapter;
  /** The catalogue's name. */
  readonly title: string;
  /** The logo's absolute path; none for Forgebook's own mark, or the title alone without branding. */
  readonly logo: string | undefined;
  /** The heights file's address, relative to the pages. */
  readonly heights: string | undefined;
  /** The project's own story globs, from the configuration's folder. */
  readonly stories: readonly string[];
  /** The project's own docs pages' globs, from the configuration's folder. */
  readonly docs: readonly string[];
  /** The written home's absolute path; none for the generated home. */
  readonly home: string | undefined;
  /** The sources' module specifiers. */
  readonly sources: readonly string[];
  /** The switches, the presets' and the catalogue's merged; none when neither declares any. */
  readonly switches: readonly ViewSwitch[] | undefined;
  /** The languages, the presets' and the catalogue's merged. */
  readonly languages: readonly StoryLanguage[];
  /** The previews' absolute paths, the presets' first, the catalogue's last. */
  readonly previews: readonly string[];
  /** The tags for every frame's `<head>`. */
  readonly head: string;
  /** The shell's look, the presets' and the catalogue's merged. */
  readonly shell: ResolvedShell;
  /** The tokens files, absolute, the base first. */
  readonly tokens: readonly ResolvedTokensFile[];
  /** The folders the dev server watches for new story files, absolute. */
  readonly watch: readonly string[];
  /** The lists (widths, backgrounds, story groups…), the presets' and the catalogue's merged. */
  readonly lists: CatalogueLists;
  /** Whether the project installs Testing Library, whose `canvas` and `userEvent` every play then receives. */
  readonly hasPlayTools: boolean;
  /** The plugins, checked, in the configuration's order. */
  readonly plugins: readonly ForgebookPlugin[];
  /** Where the stories' frames run. */
  readonly frames: ResolvedFrames;
  /** How `forgebook build` writes the catalogue, every option given its default. */
  readonly build: Required<BuildOptions>;
};

/** The packages of the play tools: both installed, or the plays get neither. */
export const PLAY_TOOLS_PACKAGES = ["@testing-library/dom", "@testing-library/user-event"] as const;

/**
 * Resolves packages as Node does from a folder: a package's (or subpath's) file, or none when it is not there.
 *
 * @param dir - the folder, the configuration's.
 */
export const packageResolver =
  (dir: string) =>
  (name: string): string | undefined => {
    const require = createRequire(resolve(dir, "package.json"));
    try {
      return require.resolve(name);
    } catch {
      return undefined;
    }
  };

/**
 * Whether the project in a folder installs the play tools' packages, found as Node finds them from there.
 *
 * @param dir - the configuration's folder.
 */
const hasPlayToolsIn = (dir: string): boolean => {
  const resolvePackage = packageResolver(dir);
  return PLAY_TOOLS_PACKAGES.every((name) => resolvePackage(name) !== undefined);
};

/**
 * The configuration file in a folder, when there is one.
 *
 * @param dir - the folder.
 */
export const findConfigFile = (dir: string): string | undefined =>
  CONFIG_FILES.map((name) => resolve(dir, name)).find((file) => existsSync(file));

/**
 * Entries by id, a later one replacing an earlier one with the same id in its place.
 *
 * @param lists - the lists, in order.
 */
const mergedById = <TEntry extends { readonly id: string }>(
  lists: readonly (readonly TEntry[] | undefined)[]
): TEntry[] => {
  const merged = new Map<string, TEntry>();
  for (const list of lists) for (const entry of list ?? []) merged.set(entry.id, entry);
  return [...merged.values()];
};

/**
 * The single values a list gives (an id, a width range, the grid's step, the toolbar…), without those it leaves out,
 * so a later list replaces only what it gives.
 *
 * @param lists - one list.
 */
const singleValues = (lists: CatalogueLists): CatalogueLists => ({
  ...(lists.id === undefined ? {} : { id: lists.id }),
  ...(lists.widths === undefined ? {} : { widths: lists.widths }),
  ...(lists.widthRange === undefined ? {} : { widthRange: lists.widthRange }),
  ...(lists.zooms === undefined ? {} : { zooms: lists.zooms }),
  ...(lists.textSizes === undefined ? {} : { textSizes: lists.textSizes }),
  ...(lists.gridStep === undefined ? {} : { gridStep: lists.gridStep }),
  ...(lists.toolbar === undefined ? {} : { toolbar: lists.toolbar }),
  ...(lists.usedIn === undefined ? {} : { usedIn: lists.usedIn }),
  ...(lists.componentDocs === undefined ? {} : { componentDocs: lists.componentDocs }),
  ...(lists.audience === undefined ? {} : { audience: lists.audience }),
  ...(lists.appearance === undefined ? {} : { appearance: lists.appearance }),
  ...(lists.propGroups === undefined ? {} : { propGroups: lists.propGroups }),
  ...(lists.requiredFirst === undefined ? {} : { requiredFirst: lists.requiredFirst })
});

/**
 * The lists of the presets and the catalogue, in that order, merged: a single value (a width range, the grid's step)
 * the last that gives one; the backgrounds, the story groups and the texts entry by entry, a later one replacing an
 * earlier one with the same id or name; the tabs, the controls and the rules turned off by any, and the accessibility
 * check too (`a11y: false`); the toolbar, the prop groups' order, where the required props go and whether the
 * component docs are read the last that names one; the device field by field.
 *
 * @param all - the presets' lists, then the catalogue's.
 */
export const mergedLists = (all: readonly CatalogueLists[]): CatalogueLists => {
  const tabs: Record<string, false> = {};
  const controls: Partial<Record<TurnedOffControl, false>> = {};
  const strings: Record<string, string> = {};
  const keys: Record<string, string | false> = {};
  let merged: CatalogueLists = {};
  // the device field by field, as a story's lies over its meta's: a preset's model stays under a catalogue's frame
  let device: StoryDeviceSetting | undefined;
  for (const lists of all) {
    if (lists.device !== undefined) device = { ...device, ...lists.device };
    Object.assign(tabs, lists.tabs);
    Object.assign(controls, lists.controls);
    Object.assign(strings, lists.strings);
    Object.assign(keys, lists.keys);
    merged = { ...merged, ...singleValues(lists) };
  }
  const builtIn = all.findLast((lists) => lists.backgrounds?.builtIn !== undefined)?.backgrounds?.builtIn;
  const rules = all.flatMap((lists) =>
    lists.a11y === undefined || lists.a11y === false ? [] : [lists.a11y]
  );
  const tags = rules.findLast((each) => each.tags !== undefined)?.tags;
  return {
    ...merged,
    ...(device === undefined ? {} : { device }),
    backgrounds: {
      ...(builtIn === undefined ? {} : { builtIn }),
      custom: mergedById(all.map((lists) => lists.backgrounds?.custom))
    },
    storyGroups: mergedById(all.map((lists) => lists.storyGroups)),
    tabs,
    controls,
    // a check one list turns off stays off, as a tab does: a preset's library may have no use for it
    a11y: all.some((lists) => lists.a11y === false)
      ? false
      : {
          ...(tags === undefined ? {} : { tags }),
          disabledRules: [...new Set(rules.flatMap((each) => each.disabledRules ?? []))]
        },
    strings,
    keys,
    // a later list's view of the same name replaces an earlier one's, where it was
    views: [...new Map(all.flatMap((lists) => lists.views ?? []).map((view) => [view.name, view])).values()]
  };
};

/** Whether a configuration's list has something in it. */
const isListed = (config: object, key: string): boolean => {
  const list: unknown = Reflect.get(config, key);
  return Array.isArray(list) && list.length > 0;
};

/**
 * Why a configuration's list of globs lists nothing by construction (only `!` patterns), or none.
 *
 * @param config - what the file exports by default.
 * @param key - the list's key.
 */
const globsProblem = (config: object, key: string): string | undefined => {
  const list: unknown = Reflect.get(config, key);
  return Array.isArray(list)
    ? patternsProblem(list.filter((item: unknown): item is string => typeof item === "string"))
    : undefined;
};

/**
 * Why a loaded configuration cannot be used, or none.
 *
 * @param config - what the file exports by default.
 */
const configProblem = (config: unknown): string | undefined => {
  if (typeof config !== "object" || config === null)
    return "it exports no configuration (`export default defineConfig({ … })`)";
  if (!("framework" in config) || typeof config.framework !== "object" || config.framework === null)
    return "it names no framework (`framework: react()`)";
  if (!("title" in config) || typeof config.title !== "string") return "it names no title";
  if (
    "home" in config &&
    config.home !== undefined &&
    config.home !== false &&
    typeof config.home !== "string"
  )
    return 'its home is neither a path (`home: "docs/home.md"`) nor false';
  if (!["stories", "sources", "docs"].some((key) => isListed(config, key)))
    return 'it names no stories (`stories: ["src/**/*.stories.tsx"]`) and no sources';
  for (const key of ["stories", "docs"]) {
    const problem = globsProblem(config, key);
    if (problem !== undefined) return `its ${key} list nothing: ${problem}`;
  }
  return framesProblem("frames" in config ? config.frames : undefined);
};

/**
 * Whether a loaded configuration is one: checked by `configProblem`.
 *
 * @param config - what the file exports by default.
 */
const isConfig = (config: unknown): config is ForgebookConfig => configProblem(config) === undefined;

/** The fields of a device setting, by name, and the type each is written in. */
const DEVICE_FIELDS: Readonly<Record<string, "boolean" | "string">> = {
  frame: "boolean",
  model: "string",
  orientation: "string",
  touch: "boolean",
  edgeToEdge: "boolean"
};

/**
 * Why a device setting cannot be used, or none: not an object of `frame`, `model`, `orientation` and `touch`, a field
 * of another type, or a model or an orientation that is none. A configuration is code, so its types are not a
 * promise.
 *
 * @param device - the setting as a configuration or a preset gives it.
 */
const deviceProblem = (device: unknown): string | undefined => {
  if (typeof device !== "object" || device === null || Array.isArray(device))
    return 'write it as an object: { frame: true, model: "iphone-16" }';
  for (const [name, value] of Object.entries(device)) {
    const type = DEVICE_FIELDS[name];
    if (type === undefined)
      return `it has no field "${name}": it takes ${Object.keys(DEVICE_FIELDS).join(", ")}`;
    if (value !== undefined && typeof value !== type)
      return `its ${name} must be ${type === "boolean" ? "true or false" : "a text"}`;
  }
  const model: unknown = Reflect.get(device, "model");
  const orientation: unknown = Reflect.get(device, "orientation");
  return deviceSettingProblem({
    ...(typeof model === "string" ? { model } : {}),
    ...(typeof orientation === "string" ? { orientation } : {})
  });
};

/**
 * The configuration's and the presets' lists, once checked where the shell would leave a mistake out: a device that
 * cannot be used, a place for the required props that is none, an accessibility setting that is neither rules nor
 * `false`.
 *
 * @param all - the presets' lists, then the configuration's.
 * @param dir - the configuration's folder, for the message.
 * @throws when a device cannot be used, `requiredFirst` is none of its layouts, or `a11y` is neither rules nor
 *   `false`.
 */
const checkedLists = (all: readonly CatalogueLists[], dir: string): readonly CatalogueLists[] => {
  for (const lists of all) {
    const problem = lists.device === undefined ? undefined : deviceProblem(lists.device);
    if (problem !== undefined)
      throw new Error(`${resolve(dir, "forgebook.config")}: Forgebook's device: ${problem}`);
    // a configuration is written by JavaScript too, which no type stops
    if (lists.requiredFirst !== undefined && !REQUIRED_FIRST_LAYOUTS.includes(lists.requiredFirst))
      throw new Error(
        `${resolve(dir, "forgebook.config")}: requiredFirst is ${typeof lists.requiredFirst === "string" ? `"${lists.requiredFirst}"` : String(lists.requiredFirst)}, none of "in-groups", "section" and false`
      );
    const a11y: unknown = lists.a11y;
    if (
      a11y !== undefined &&
      a11y !== false &&
      (typeof a11y !== "object" || a11y === null || Array.isArray(a11y))
    )
      throw new Error(
        `${resolve(dir, "forgebook.config")}: a11y is ${String(a11y)}: write its rules ({ tags, disabledRules }), or false to check nothing`
      );
  }
  return all;
};

/**
 * Why the merged lists ask for what cannot be, or none: an audience that is none of the ids (the page reads it as one,
 * and a configuration is written by JavaScript too, which no type stops), or "Used in" turned on with the component
 * docs off, whose TypeScript programs read the import graph it is joined from.
 *
 * @param lists - the presets' lists and the configuration's, merged.
 */
const mergedListsProblem = (lists: CatalogueLists): string | undefined => {
  if (lists.audience !== undefined && !AUDIENCE_IDS.includes(lists.audience))
    return `the audience "${lists.audience}" is none of ${AUDIENCE_IDS.join(", ")}`;
  if (lists.usedIn === true && lists.componentDocs === false)
    return "usedIn is true with componentDocs false: Used in reads the import graph with the programs componentDocs turns off";
  return undefined;
};

/** What a catalogue shows: its own stories and docs pages, and the sources; none where it names none. */
const shownFiles = (config: ForgebookConfig): Pick<ResolvedConfig, "stories" | "docs" | "sources"> => ({
  stories: config.stories ?? [],
  docs: config.docs ?? [],
  sources: config.sources ?? []
});

/**
 * The written home's absolute path: the configuration's `home`, else `forgebook.home.md` beside it when there; none
 * with `home: false`.
 *
 * @param config - the configuration.
 * @param dir - the folder of its file.
 * @throws when the configuration names a home that is not there.
 */
const homeOf = (config: ForgebookConfig, dir: string): string | undefined => {
  if (config.home === false) return undefined;
  if (config.home === undefined) {
    const beside = VITE_PATHS.join(dir, HOME_FILE);
    return existsSync(beside) ? beside : undefined;
  }
  const home = VITE_PATHS.resolve(dir, config.home);
  if (!existsSync(home) || !statSync(home).isFile())
    throw new Error(`${resolve(dir, "forgebook.config")}: its home "${config.home}" is not a file there`);
  return home;
};

/**
 * A configuration's plugins, once they can be used.
 *
 * @param config - the configuration.
 * @param dir - the folder of its file.
 * @throws when they cannot.
 */
const checkedPlugins = (config: ForgebookConfig, dir: string): readonly ForgebookPlugin[] => {
  const plugins = config.plugins ?? [];
  const problem = pluginsProblem(plugins, config.framework.name, dir);
  if (problem !== undefined) throw new Error(`${resolve(dir, "forgebook.config")}: ${problem}`);
  return plugins;
};

/**
 * Whether Forgebook's mark may stand in for a logo: on, unless the last that says so turns it off.
 *
 * @param all - the presets, then the catalogue.
 */
const hasBrandingIn = (all: readonly Pick<ForgebookConfig, "shell">[]): boolean =>
  all.findLast((each) => each.shell?.branding !== undefined)?.shell?.branding !== false;

/**
 * A configuration with its presets merged and its paths made absolute, in Vite's form.
 *
 * @param config - the configuration.
 * @param fileDir - the folder of its file.
 * @param paths - the path functions; the running system's unless a test names another.
 * @throws when the merged switches cannot be used.
 */
export const resolveConfig = (
  config: ForgebookConfig,
  fileDir: string,
  paths: VitePaths = VITE_PATHS
): ResolvedConfig => {
  const presets = config.presets ?? [];
  const dir = paths.normalize(fileDir);
  const absolute = (path: string): string => paths.resolve(dir, path);
  // a preset's preview and style sheet are absolute paths (its own files) or a package's specifier, kept as written
  const ownPath = (path: string): string => (paths.isAbsolute(path) ? paths.normalize(path) : path);
  const declared = [...presets.map((preset) => preset.switches), config.switches];
  const plugins = checkedPlugins(config, dir);
  const switches = withPluginSwitches(
    declared.some((list) => list !== undefined) ? mergedById(declared) : undefined,
    plugins
  );
  const problem = switches === undefined ? undefined : switchesProblem(switches);
  if (problem !== undefined) throw new Error(`${resolve(dir, "forgebook.config")}: ${problem}`);
  const declaredThemes = [...presets.map((preset) => preset.shell?.theme ?? {}), config.shell?.theme ?? {}];
  const tokens = (config.tokens ?? []).map((each) =>
    typeof each === "string"
      ? { path: absolute(each), mode: undefined }
      : { path: absolute(each.file), mode: each.mode }
  );
  const fromTokens = Object.assign({}, ...declaredThemes.map((each) => each.fromTokens));
  const tokenThemed = tokenThemeOf(fromTokens, tokens, dir);
  const theme = mergedThemes([tokenThemed.theme, ...declaredThemes]);
  const lists = mergedLists(checkedLists([...presets, config], dir));
  const listsProblem = mergedListsProblem(lists);
  if (listsProblem !== undefined) throw new Error(`${resolve(dir, "forgebook.config")}: ${listsProblem}`);
  const themeProblem = themeValueProblem(theme);
  if (themeProblem !== undefined) throw new Error(`${resolve(dir, "forgebook.config")}: ${themeProblem}`);
  const ownPreview =
    config.preview === undefined
      ? PREVIEW_FILES.map((name) => paths.join(dir, name)).find((file) => existsSync(file))
      : absolute(config.preview);
  return {
    dir,
    framework: config.framework,
    title: config.title,
    home: homeOf(config, dir),
    logo: config.logo === undefined ? undefined : absolute(config.logo),
    heights: config.heights,
    ...shownFiles(config),
    switches,
    languages: mergedById([...presets.map((preset) => preset.languages), config.languages]),
    previews: [
      ...presets.flatMap((preset) => (preset.preview === undefined ? [] : [ownPath(preset.preview)])),
      ...(ownPreview === undefined ? [] : [ownPreview])
    ],
    head: [...presets.map((preset) => preset.head ?? ""), config.head ?? ""]
      .filter((tags) => tags !== "")
      .join("\n"),
    shell: {
      themeCss: shellThemeCss(theme),
      frameCss: frameThemeCss(theme),
      hasBranding: hasBrandingIn([...presets, config]),
      styleSheets: [
        ...presets.flatMap((preset) => (preset.shell?.css === undefined ? [] : [ownPath(preset.shell.css)])),
        ...(config.shell?.css === undefined ? [] : [absolute(config.shell.css)])
      ],
      problems: [...tokenThemed.problems, ...shellThemeProblems(theme)]
    },
    tokens,
    watch: (config.watch ?? []).map(absolute),
    lists,
    hasPlayTools: hasPlayToolsIn(dir),
    plugins,
    frames: resolvedFrames(config.frames),
    build: { readableNames: config.build?.readableNames === true }
  };
};

/**
 * Loads a configuration file and resolves it.
 *
 * @param file - the file's absolute path.
 * @throws when the file does not load, or exports no usable configuration.
 */
export const loadConfigFile = async (file: string): Promise<ResolvedConfig> => {
  const module: unknown = await import(pathToFileURL(file).href);
  const config: unknown =
    typeof module === "object" && module !== null && "default" in module ? module.default : undefined;
  if (!isConfig(config)) throw new Error(`${file}: ${configProblem(config) ?? "it cannot be read"}`);
  return resolveConfig(config, dirname(file));
};
