/**
 * The story files a catalogue's patterns pass over because they sit in a hidden folder (`docs/.vitepress/…`): a glob's
 * `**` does not enter a folder whose name starts with a dot, so such files are never listed, and nothing said why. The
 * stories answer, the dev server and the commands that stop on an empty pattern name them, with a pattern that lists
 * them.
 *
 * @remarks
 * Each pattern with a `**` is globbed again with a hidden folder allowed at that place (`**\/.*\/**`), as the
 * catalogue's own listing globs (Node's `globSync`), leaving out `.git` and `node_modules`. A file another pattern lists,
 * or a `!` pattern leaves out (its hidden folders read as plain ones), is not named: writing `!docs/.vitepress/**` says
 * the folder is left out on purpose and ends the notice.
 *
 * @module
 */
import { globSync } from "node:fs";
import { matchesGlob } from "node:path";

import { isNegated } from "./storyPatterns.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** Folders never entered: they hold no story, and can hold very many files. */
const NOT_ENTERED = /(^|[\\/])(\.git|node_modules)$/;

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
  const folders = new Map<string, { pattern: string; files: string[] }>();
  for (const pattern of listed.filter((each) => each.includes("**"))) {
    const widened = pattern.replace("**", "**/.*/**");
    for (const found of globSync(widened, {
      cwd: config.dir,
      exclude: (name: string): boolean => NOT_ENTERED.test(name)
    })) {
      const file = VITE_PATHS.normalize(found);
      if (listed.some((each) => matchesGlob(file, each))) continue;
      if (leftOut.some((each) => matchesGlob(undotted(file), each))) continue;
      const segments = file.split("/");
      const hidden = segments.findIndex(
        (segment, index) => segment.startsWith(".") && index < segments.length - 1
      );
      if (hidden === -1) continue;
      const folder = segments.slice(0, hidden + 1).join("/");
      const last = pattern.split("/").pop() ?? "*";
      const entry = folders.get(folder) ?? { pattern: `${folder}/**/${last}`, files: [] };
      entry.files.push(file);
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
