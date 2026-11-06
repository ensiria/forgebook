/**
 * The answer to `changed`: the stories a change touches, read from the files git names and the import graph "Used in"
 * reads, and for each changed UI file the stories that show it.
 *
 * @remarks
 * The preview and the style sheets it or a source's module name are shown by every story, though no story imports them.
 * Only those count: a preview also imports its decorators, often from a library's barrel, and following that would
 * make a component look covered for being exported.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { realpath } from "node:fs/promises";

import { offersUsedIn, readsComponentDocs } from "../catalogue.ts";
import { sourceFiles } from "../sourceFiles.ts";
import { findComponentByTitle } from "../storyTree.ts";
import type { AgentChangedStory, ChangedStoriesDocument } from "./agent.types.ts";
import { storyLinks } from "./agentApi.ts";
import type { AgentAnswer, RouteContext } from "./agentRoutes.ts";
import {
  belongsToOtherCatalogue,
  changedUiFiles,
  deletedForms,
  type IdentifiedStory
} from "./changeCoverage.ts";
import { findConfigFile, type ResolvedConfig } from "./configFile.ts";
import { catalogueChangedFiles, changeBase, changedFiles, noBaseReason } from "./gitChange.ts";
import type { ResolveSource } from "./storylessRoutes.ts";
import { affectedStories, type ReachedStory } from "./storyReach.ts";
import { assetImports, sheetImports } from "./textImports.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** Whether a value is a list of stories with what they reach. */
const isReach = (value: unknown): value is readonly ReachedStory[] => Array.isArray(value);

/** A file's text; a file that cannot be read has none. */
const textOf = (file: string): string => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
};

/** The files every story shows: the previews, and the sheets they and the sources' modules name, followed. */
const everyStoryFiles = async (
  config: ResolvedConfig,
  resolveSource: ResolveSource
): Promise<Set<string>> => {
  const sourceModules = await Promise.all(
    config.sources.map(async (specifier) => {
      const id = await resolveSource(specifier).catch(() => undefined);
      return id?.split("?")[0];
    })
  );
  const modules = [...config.previews, ...sourceModules.flatMap((file) => file ?? [])]
    .filter((file) => VITE_PATHS.isAbsolute(file))
    .map((file) => VITE_PATHS.normalize(file));
  const found = new Set<string>(config.previews.map((file) => VITE_PATHS.normalize(file)));
  const queue = modules.flatMap((file) => assetImports(file, textOf(file)));
  while (queue.length > 0) {
    const sheet = queue.pop() ?? "";
    if (found.has(sheet)) continue;
    found.add(sheet);
    queue.push(...sheetImports(sheet, textOf(sheet)));
  }
  return found;
};

/** Why a group's reach could not be read, when that is what it answered. */
const failureOf = (reach: unknown): string | undefined =>
  typeof reach === "string" ? `The stories' imports could not be read: ${reach}` : undefined;

/** Without the import graph no story is found, which must not read as a change that touches none. */
const graphProblems = (config: ResolvedConfig): readonly string[] => {
  if (offersUsedIn(config.lists)) return [];
  return [
    readsComponentDocs(config.lists)
      ? "No story is found through the imports: the catalogue turns Used in off (usedIn: false), whose import graph this reads"
      : "No story is found through the imports: the catalogue reads no component docs (componentDocs: false), whose programs read the import graph"
  ];
};

/**
 * The stories a change touches and the changed UI files with their stories.
 *
 * @param context - what the routes read.
 * @param resolveSource - finds the file of a source's module.
 */
export const changedAnswer = async (
  { config, loaded, tree, params, pages, view }: RouteContext,
  resolveSource: ResolveSource
): Promise<AgentAnswer> => {
  const since = params.get("since") || "HEAD";
  const base = await changeBase(config.dir, since);
  if (base === undefined) return { status: 400, body: { error: await noBaseReason(config.dir, since) } };
  const { root, files, deleted } = await changedFiles(config.dir, base);
  const groups = await Promise.all(
    loaded.sources.flatMap((source) =>
      source.files.map(async (group) => ({ source: source.id, reach: await group.reach?.() }))
    )
  );
  const identified = groups.flatMap(({ source, reach }) =>
    (isReach(reach) ? reach : []).flatMap((story): IdentifiedStory[] => {
      const component = findComponentByTitle(tree, source, story.title)?.component;
      const found = [...(component?.stories ?? []), ...(component?.unlisted ?? [])].find(
        (each) => each.exportName === story.exportName
      );
      return found === undefined ? [] : [{ id: found.id, reach: story }];
    })
  );
  const realDir = await realpath(config.dir);
  const absolute = catalogueChangedFiles(config.dir, realDir, root, files);
  const gone = new Set(deleted);
  const changed = absolute.flatMap((file, index) =>
    gone.has(files[index] ?? "") ? deletedForms(file) : [file]
  );
  const shownByAll = await everyStoryFiles(config, resolveSource);
  const touched = absolute.some((file) => shownByAll.has(file))
    ? identified.map(({ reach }) => reach)
    : affectedStories(
        identified.map(({ reach }) => reach),
        changed
      );
  const touchedSet = new Set(touched);
  const stories = identified
    .filter(({ reach }) => touchedSet.has(reach))
    .map(
      ({ id, reach }): AgentChangedStory => ({
        id,
        title: reach.title,
        links: storyLinks(pages, id, view)
      })
    );
  const { uiFiles, outside } = changedUiFiles({
    files: files.map((file, index) => {
      const inCatalogue = absolute[index] ?? "";
      return {
        file,
        path: VITE_PATHS.relative(config.dir, inCatalogue),
        absolute: inCatalogue,
        isDeleted: gone.has(file)
      };
    }),
    stories: identified,
    everyStoryFiles: shownByAll,
    isOtherCatalogues: (file: string): boolean =>
      belongsToOtherCatalogue(
        file,
        VITE_PATHS.normalize(config.dir),
        VITE_PATHS.join(config.dir, VITE_PATHS.relative(realDir, root)),
        (folder) => findConfigFile(folder) !== undefined
      ),
    readText: (file: string): string => textOf(VITE_PATHS.join(root, file))
  });
  const unread = loaded.sources.flatMap((source) => sourceFiles(source).problems ?? []);
  const problems = [
    ...new Set([
      ...unread,
      ...graphProblems(config),
      ...groups.flatMap(({ reach }) => failureOf(reach) ?? []),
      ...tree.problems
    ])
  ];
  const body: ChangedStoriesDocument = {
    schema: 1,
    since,
    files,
    stories,
    uiFiles,
    outside,
    problems,
    ...(unread.length === 0 ? {} : { unread })
  };
  return { status: 200, body };
};
