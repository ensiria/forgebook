/**
 * The story files a catalogue's patterns pass over because they sit in a hidden folder (`docs/.vitepress/…`): a glob's
 * `**` does not enter a folder whose name starts with a dot, so such files are never listed, and nothing said why. The
 * stories answer, the dev server and the commands that stop on an empty pattern name them, with a pattern that lists
 * them.
 *
 * @remarks
 * For each pattern with a `**`, the hidden folders under its static start are found (folders only, at most
 * `MAX_FOLDERS`, leaving out `.git` and `node_modules`), and the pattern's file name is globbed in each by its name
 * (`docs/.vitepress/**\/*.stories.ts`), as the catalogue's own listing globs (Node's `globSync`, which reads a hidden
 * folder named in a pattern on every version). A file another pattern lists,
 * or a `!` pattern leaves out (its hidden folders read as plain ones), is not named: writing `!docs/.vitepress/**` says
 * the folder is left out on purpose and ends the notice.
 *
 * @module
 */
import { type Dirent, globSync, readdirSync } from "node:fs";
import { matchesGlob } from "node:path";

import { patternBase } from "./autoTitle.ts";
import { isNegated } from "./storyPatterns.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** Folders never entered: they hold no story, and can hold very many files. */
const NOT_ENTERED = /(^|[\\/])(\.git|node_modules)$/;

/** How many folders are read at most to find the hidden ones: a pattern starting at the project's root reads many. */
const MAX_FOLDERS = 20_000;

/** A folder's sub-folders; none when it cannot be read. */
const foldersIn = (dir: string): Dirent[] => {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  } catch {
    return [];
  }
};

/**
 * The topmost hidden folders under a folder, relative to the root.
 *
 * @param root - the catalogue's folder.
 * @param base - the folder to look under, relative to the root.
 */
const hiddenFoldersUnder = (root: string, base: string): string[] => {
  const found: string[] = [];
  const queue = [base];
  let read = 0;
  while (queue.length > 0 && read < MAX_FOLDERS) {
    const folder = queue.pop() ?? "";
    for (const entry of foldersIn(VITE_PATHS.resolve(root, folder))) {
      read += 1;
      if (NOT_ENTERED.test(entry.name)) continue;
      const path = folder === "" ? entry.name : `${folder}/${entry.name}`;
      if (entry.name.startsWith(".")) found.push(path);
      else queue.push(path);
    }
  }
  return found;
};

/** A path or a pattern with each segment's leading dot taken off, so a glob reads it as an ordinary folder. */
const undotted = (path: string): string => path.replace(/(^|\/)\.(?=[^./])/g, "$1");

/** A hidden folder a file sits in, and the pattern that lists that folder's story files. */
type HiddenFolder = { readonly folder: string; readonly pattern: string; readonly files: readonly string[] };

/**
 * The story files the patterns pass over in hidden folders, grouped by the first hidden folder each sits in, with the
 * pattern that lists them.
 *
 * @param config - the catalogue's folder and its stories' patterns.
 */
export const hiddenStoryFolders = (config: {
  readonly dir: string;
  readonly stories: readonly string[];
}): HiddenFolder[] => {
  const plain = (pattern: string): string => pattern.replace(/^\.\//, "");
  const listed = config.stories.filter((each) => !isNegated(each)).map(plain);
  const leftOut = config.stories.filter(isNegated).map((each) => undotted(plain(each.slice(1))));
  // a file in one, as the pattern would match it with the folder's dot taken off, that nothing lists or leaves out
  const isPassedOver = (file: string, pattern: string): boolean =>
    matchesGlob(undotted(file), undotted(pattern)) &&
    !listed.some((each) => matchesGlob(file, each)) &&
    !leftOut.some((each) => matchesGlob(undotted(file), each));
  const folders = new Map<string, { pattern: string; files: string[] }>();
  for (const pattern of listed.filter((each) => each.includes("**"))) {
    const last = pattern.split("/").pop() ?? "*";
    for (const folder of hiddenFoldersUnder(config.dir, patternBase(pattern).replace(/^\.\/?/, ""))) {
      const named = `${folder}/**/${last}`;
      const files = globSync(named, { cwd: config.dir })
        .map((found) => VITE_PATHS.normalize(found))
        .filter((file) => isPassedOver(file, pattern));
      if (files.length === 0) continue;
      const entry = folders.get(folder) ?? { pattern: named, files: [] };
      entry.files.push(...files);
      folders.set(folder, entry);
    }
  }
  return [...folders]
    .map(([folder, entry]) => ({ folder, pattern: entry.pattern, files: [...new Set(entry.files)].sort() }))
    .sort((a, b) => a.folder.localeCompare(b.folder));
};

/** How many hidden folders a message names before it says how many more there are. */
const NAMED_FOLDERS = 3;

/**
 * What to say of the folders of `hiddenStoryFolders`: how many files, where, and the patterns that list them.
 *
 * @param folders - the folders, at least one.
 */
export const hiddenStoryFoldersMessage = (folders: readonly HiddenFolder[]): string => {
  const files = folders.reduce((sum, each) => sum + each.files.length, 0);
  const named = folders.slice(0, NAMED_FOLDERS).map((each) => `\`${each.pattern}\``);
  const more = folders.length > NAMED_FOLDERS ? `, and ${folders.length - NAMED_FOLDERS} more folders` : "";
  return `${files === 1 ? "1 story file sits" : `${files} story files sit`} in a hidden folder the stories' patterns do not enter: list ${files === 1 ? "it" : "them"} with ${named.join(", ")}${more}, or write a \`!\` pattern for the folder to leave it out`;
};
