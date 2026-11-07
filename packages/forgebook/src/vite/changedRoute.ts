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
import { isComponentDocs } from "../componentDocs.ts";
import { propsSignature, writtenSignature } from "../propsSignature.ts";
import { shellWord } from "../shellWord.ts";
import { sourceFiles } from "../sourceFiles.ts";
import { findComponentByTitle } from "../storyTree.ts";
import type { AgentChangedStory, ChangedStoriesDocument, OutdatedStoryFile } from "./agent.types.ts";
import { storyLinks } from "./agentApi.ts";
import { type AgentAnswer, type RouteContext, settled } from "./agentRoutes.ts";
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

/** A story the reach found in the tree, with its source and the file as that source lists it. */
export type FoundStory = IdentifiedStory & {
  /** Its source's id. */
  readonly source: string;
  /** Its file, as its source lists it (`./src/Badge.stories.tsx`). */
  readonly file: string;
};

/** A touched story file: where it is on disk, one of its stories, and what loads its component's docs. */
type TouchedFile = {
  /** The file, absolute. */
  readonly absolute: string;
  /** One of its stories' ids. */
  readonly story: string;
  /** What loads the docs of the component its meta names. */
  readonly docs: (() => Promise<unknown>) | undefined;
};

/**
 * The touched story files `forgebook new` wrote for other props than their component has now.
 *
 * @param touched - the touched story files, once each.
 * @param dir - the catalogue's folder.
 * @param root - the repository's folder, as the catalogue's folder is reached.
 */
const outdatedFiles = async (
  touched: readonly TouchedFile[],
  dir: string,
  root: string
): Promise<OutdatedStoryFile[]> => {
  const found = await Promise.all(
    touched.map(async (file): Promise<OutdatedStoryFile[]> => {
      const written = writtenSignature(textOf(file.absolute));
      if (written === undefined) return [];
      // only a file that says what it was written for is compared: docs that cannot be read leave it alone
      const docs = await settled(file.docs);
      if (!("value" in docs) || !isComponentDocs(docs.value)) return [];
      const current = propsSignature(docs.value.props);
      if (current === written) return [];
      const path = VITE_PATHS.relative(dir, file.absolute);
      return [
        {
          file: VITE_PATHS.relative(root, file.absolute),
          path,
          story: file.story,
          component: docs.value.name,
          written,
          current,
          // the names reach a command an agent runs, so they are quoted; the signature is eight hexadecimal digits
          fix: `check the args in ${shellWord(path)} against the props npx forgebook story ${shellWord(file.story)} --json lists, then set its forgebook-props line to ${current}; or write it again with npx forgebook new on the component file it imports, with --force, which replaces any edit`
        }
      ];
    })
  );
  return found.flat();
};

/**
 * The catalogue's stories with what each reaches, and each group's answer, whose failure a route has to say.
 *
 * @param loaded - the sources.
 * @param tree - their story tree.
 */
export const identifiedStories = async (
  loaded: RouteContext["loaded"],
  tree: RouteContext["tree"]
): Promise<{
  readonly groups: readonly { readonly source: string; readonly reach: unknown }[];
  readonly identified: readonly FoundStory[];
}> => {
  const groups = await Promise.all(
    loaded.sources.flatMap((source) =>
      source.files.map(async (group) => ({ source: source.id, reach: await group.reach?.() }))
    )
  );
  const identified = groups.flatMap(({ source, reach }) =>
    (isReach(reach) ? reach : []).flatMap((story): FoundStory[] => {
      const component = findComponentByTitle(tree, source, story.title)?.component;
      const found = [...(component?.stories ?? []), ...(component?.unlisted ?? [])].find(
        (each) => each.exportName === story.exportName
      );
      return found === undefined ? [] : [{ id: found.id, reach: story, source, file: found.file }];
    })
  );
  return { groups, identified };
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
  const { groups, identified } = await identifiedStories(loaded, tree);
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
  const touchedFiles = new Map<string, TouchedFile>();
  for (const story of identified.filter(({ reach }) => touchedSet.has(reach))) {
    const source = loaded.sources.find((each) => each.id === story.source);
    if (source !== undefined && !touchedFiles.has(story.reach.storyFile))
      touchedFiles.set(story.reach.storyFile, {
        absolute: story.reach.storyFile,
        story: story.id,
        docs: sourceFiles(source).docs[story.file]
      });
  }
  const outdated = await outdatedFiles(
    [...touchedFiles.values()],
    config.dir,
    VITE_PATHS.join(config.dir, VITE_PATHS.relative(realDir, root))
  );
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
    ...(unread.length === 0 ? {} : { unread }),
    ...(outdated.length === 0 ? {} : { outdated })
  };
  return { status: 200, body };
};
