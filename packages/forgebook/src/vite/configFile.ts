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
import { existsSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { StoryLanguage } from "@forgebook/story-format/source";

import { switchesProblem, type ViewSwitch } from "../switches.ts";
import type { FrameworkAdapter } from "./adapter.ts";
import type { ForgebookConfig } from "./config.ts";

/** The names a configuration file may have, in the order they are looked for. */
export const CONFIG_FILES = ["forgebook.config.ts", "forgebook.config.mts", "forgebook.config.js"];

/** The names a preview may have beside the configuration, in the order they are looked for. */
const PREVIEW_FILES = ["forgebook.preview.ts", "forgebook.preview.tsx", "forgebook.preview.js"];

/** A configuration ready for the pages: its folder, its presets merged, its paths absolute. */
export type ResolvedConfig = {
  /** The folder the configuration file is in: Vite's root. */
  readonly dir: string;
  /** The framework. */
  readonly framework: FrameworkAdapter;
  /** The catalogue's name. */
  readonly title: string;
  /** The logo's absolute path; none for Forgebook's own mark. */
  readonly logo: string | undefined;
  /** The heights file's address, relative to the pages. */
  readonly heights: string | undefined;
  /** The project's own story globs, from the configuration's folder. */
  readonly stories: readonly string[];
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
  /** The folders the dev server watches for new story files, absolute. */
  readonly watch: readonly string[];
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
  const hasStories = "stories" in config && Array.isArray(config.stories) && config.stories.length > 0;
  const hasSources = "sources" in config && Array.isArray(config.sources) && config.sources.length > 0;
  if (!hasStories && !hasSources)
    return 'it names no stories (`stories: ["src/**/*.stories.tsx"]`) and no sources';
  return undefined;
};

/**
 * Whether a loaded configuration is one: checked by `configProblem`.
 *
 * @param config - what the file exports by default.
 */
const isConfig = (config: unknown): config is ForgebookConfig => configProblem(config) === undefined;

/**
 * A configuration with its presets merged and its paths made absolute.
 *
 * @param config - the configuration.
 * @param dir - the folder of its file.
 * @throws when the merged switches cannot be used.
 */
export const resolveConfig = (config: ForgebookConfig, dir: string): ResolvedConfig => {
  const presets = config.presets ?? [];
  const absolute = (path: string): string => (isAbsolute(path) ? path : resolve(dir, path));
  const declared = [...presets.map((preset) => preset.switches), config.switches];
  const switches = declared.some((list) => list !== undefined) ? mergedById(declared) : undefined;
  const problem = switches === undefined ? undefined : switchesProblem(switches);
  if (problem !== undefined) throw new Error(`${resolve(dir, "forgebook.config")}: ${problem}`);
  const ownPreview =
    config.preview === undefined
      ? PREVIEW_FILES.map((name) => resolve(dir, name)).find((file) => existsSync(file))
      : absolute(config.preview);
  return {
    dir,
    framework: config.framework,
    title: config.title,
    logo: config.logo === undefined ? undefined : absolute(config.logo),
    heights: config.heights,
    stories: config.stories ?? [],
    sources: config.sources ?? [],
    switches,
    languages: mergedById([...presets.map((preset) => preset.languages), config.languages]),
    previews: [
      ...presets.flatMap((preset) => (preset.preview === undefined ? [] : [preset.preview])),
      ...(ownPreview === undefined ? [] : [ownPreview])
    ],
    head: [...presets.map((preset) => preset.head ?? ""), config.head ?? ""]
      .filter((tags) => tags !== "")
      .join("\n"),
    watch: (config.watch ?? []).map(absolute)
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
