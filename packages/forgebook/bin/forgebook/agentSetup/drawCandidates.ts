/**
 * Which of a project's components to try first when `forgebook init --draw` looks for one that draws.
 *
 * @remarks
 * A leaf of a design system needs the least of what the app sets up, so names and folders that say so come first, smaller
 * files before larger, and what says page, layout, provider or route comes last or not at all. Only the names are read
 * here, with each file's size: `forgebook new` reads the file itself, and says when it exports no component.
 *
 * @module
 */
import { type Dirent, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { VITE_PATHS } from "../../../src/vite/vitePaths.ts";

/** What a component file of each framework ends in. */
const COMPONENT_FILES: Readonly<Record<string, RegExp>> = {
  vue: /\.vue$/,
  nuxt: /\.vue$/,
  svelte: /\.svelte$/,
  sveltekit: /\.svelte$/,
  angular: /\.component\.ts$/,
  "web-components": /\.[jt]s$/,
  html: /\.[jt]s$/
};

/** A component file where the framework's are TSX or JSX. */
const JSX_FILE = /\.[jt]sx$/;

/** What is never a component to draw, by its path. */
const NOT_COMPONENT =
  /(?:\.(?:test|spec|stories|e2e|cy|d)\.|(?:^|\/)(?:__\w+__|tests?|e2e|cypress|mocks?|fixtures|stories|node_modules|dist|build|out|coverage|public|\.[^/]+)\/|(?:^|\/)\+|\[[^/]*\]|(?:^|\/)(?:_app|_document|_error|main|index|entry[-.\w]*|root|error|global-error|loading|not-found|template|default|middleware|instrumentation)\.[^/]+$)/i;

/** Names a small, self-contained component usually has. */
const LEAF_NAME =
  /(?:^|[/-])(?:button|badge|label|separator|spinner|skeleton|icon|logo|avatar|kbd|tag|chip|card|alert|input|text|title|heading|divider|link|progress|checkbox|switch)[^/]*$/i;

/** A folder a design system keeps its parts in. */
const UI_FOLDER = /(?:^|\/)(?:ui|atoms|primitives|base|common|shared|elements|design-system)\//i;

/** A folder of components. */
const COMPONENT_FOLDER = /(?:^|\/)components?\//i;

/** What needs most of what the app sets up. */
const APP_SHAPED =
  /(?:page|layout|provider|route|router|app|screen|view|context|store|modal|dialog|form|table|chart|editor|sidebar|nav|header|footer|shell)[^/]*$|(?:^|\/)(?:app|pages|routes|views|screens|features|layouts|providers)\//i;

/** How many folders a search goes through, so a huge repository's first run stays quick. */
const SEARCH_LIMIT = 5000;

/** How many files are ranked. */
const FILE_LIMIT = 5000;

/** How many candidates come back: past these, the reason is rarely the component. */
export const CANDIDATE_LIMIT = 8;

/**
 * How promising a component's path is: lower comes first.
 *
 * @param path - the file, from the project's folder, with forward slashes.
 * @param size - its size in bytes.
 */
export const candidateRank = (path: string, size: number): number => {
  let rank = Math.min(size / 200, 40);
  if (LEAF_NAME.test(path)) rank -= 60;
  if (UI_FOLDER.test(path)) rank -= 40;
  else if (COMPONENT_FOLDER.test(path)) rank -= 15;
  if (APP_SHAPED.test(path)) rank += 60;
  return rank;
};

/**
 * The top folders story patterns cover: a component outside them gets stories the catalogue does not list.
 *
 * @param patterns - the patterns (`{app,components}/**\/*.stories.tsx`).
 * @returns the folders; none when any pattern covers more than folders can say, so nothing is left out.
 */
export const storyFolders = (patterns: readonly string[]): readonly string[] => {
  const folders: string[] = [];
  for (const pattern of patterns) {
    if (pattern.startsWith("!")) continue;
    const first = pattern.split("/")[0] ?? "";
    if (first === "" || !pattern.includes("/") || first === "**" || first.startsWith(".")) return [];
    folders.push(...first.replace(/^\{|\}$/g, "").split(","));
  }
  return folders;
};

/** A folder's entries; none for one the command may not read, which only leaves its files out. */
const entriesOf = (dir: string): readonly Dirent[] => {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
};

/** A component file with how promising it is. */
type Candidate = { readonly path: string; readonly rank: number };

/**
 * The project's component files to try, the most promising first.
 *
 * @param projectDir - the project's folder.
 * @param framework - the adapter's name.
 * @param folders - the top folders to look in; every one when none.
 * @returns the files, from the project's folder.
 */
export const drawCandidates = (
  projectDir: string,
  framework: string,
  folders: readonly string[] = []
): readonly string[] => {
  const isComponent = COMPONENT_FILES[framework] ?? JSX_FILE;
  const queue = folders.length === 0 ? [projectDir] : folders.map((folder) => join(projectDir, folder));
  const found: Candidate[] = [];
  const noteEntry = (entry: Dirent, full: string): void => {
    const path = VITE_PATHS.normalize(relative(projectDir, full));
    if (entry.isDirectory() && !NOT_COMPONENT.test(`${path}/`)) queue.push(full);
    if (entry.isFile() && isComponent.test(entry.name) && !NOT_COMPONENT.test(path))
      found.push({ path, rank: candidateRank(path, statSync(full).size) });
  };
  for (const dir of queue) {
    if (queue.length > SEARCH_LIMIT || found.length > FILE_LIMIT) break;
    for (const entry of entriesOf(dir)) noteEntry(entry, join(dir, entry.name));
  }
  return found
    .sort((a, b) => a.rank - b.rank || a.path.localeCompare(b.path))
    .slice(0, CANDIDATE_LIMIT)
    .map(({ path }) => path);
};
