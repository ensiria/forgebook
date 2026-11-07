/**
 * Whether a project's `tsconfig.json` declares `paths`, so a catalogue can turn on Vite's reading of them only for a
 * project that has some.
 *
 * @remarks
 * Vite resolves them itself (`resolve.tsconfigPaths`), and asks the resolver to look for a `tsconfig` for every module,
 * so a project with no `paths` is not made to pay. Nothing here runs: the files are searched as text, comments and all,
 * because the compiler is far too slow to load for one question and a false yes only costs that small price. A template
 * often keeps `paths` in a file the main one names under `references` or `extends` (`tsconfig.app.json`,
 * a monorepo's `tsconfig.base.json`), so those are followed.
 *
 * @module
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** The files a project's search starts from. */
const STARTING_FILES = ["tsconfig.json", "tsconfig.app.json"];

/** How many files a search reads: a chain is short, and the files are the project's to write. */
const MAX_FILES = 32;

/** The largest file read, in bytes. */
const MAX_FILE_SIZE = 1_000_000;

/** A `paths` key, or a `baseUrl`, which Vite resolves through as well. */
const PATHS_KEY = /"(?:paths|baseUrl)"\s*:/;

/** The value of an `extends` key, one path or a list. */
const EXTENDS_VALUE = /"extends"\s*:\s*("[^"\n]+"|\[[^\]]*\])/;

/** The list under a `references` key. */
const REFERENCES_VALUE = /"references"\s*:\s*\[([^\]]*)\]/;

/** A text in JSON. */
const QUOTED = /"([^"\n]+)"/g;

/** A `path` key of a reference. */
const REFERENCE_PATH = /"path"\s*:\s*"([^"\n]+)"/g;

/**
 * The files a `tsconfig`'s text points to: its `extends` and `references`, those a path names (a package's are left out,
 * since a package's shared configuration has no `paths` of the project's).
 *
 * @param text - the file's text.
 * @returns the paths as written.
 */
export const namedTsconfigs = (text: string): readonly string[] => {
  const extended = [...(text.match(EXTENDS_VALUE)?.[1] ?? "").matchAll(QUOTED)].flatMap((each) =>
    each[1] === undefined ? [] : [each[1]]
  );
  const referenced = [...(text.match(REFERENCES_VALUE)?.[1] ?? "").matchAll(REFERENCE_PATH)].flatMap(
    (each) => (each[1] === undefined ? [] : [each[1]])
  );
  // a bare `extends` is a package's; a bare reference is a file beside this one
  return [...extended.filter((path) => path.startsWith(".")), ...referenced];
};

/**
 * The file a path in a `tsconfig` names: the path itself, its `.json`, or a folder's `tsconfig.json`.
 *
 * @param from - the folder of the file that names it.
 * @param path - the path as written.
 */
const namedFile = (from: string, path: string): string | undefined => {
  const named = resolve(from, path);
  return [named, `${named}.json`, join(named, "tsconfig.json")].find(
    (file) => existsSync(file) && statSync(file).isFile()
  );
};

/**
 * Whether a project's `tsconfig` files declare `paths`.
 *
 * @param dir - the project's folder.
 */
export const hasTsconfigPaths = (dir: string): boolean => {
  const queue = STARTING_FILES.map((name) => join(dir, name)).filter((file) => existsSync(file));
  const seen = new Set(queue);
  for (const file of queue) {
    if (seen.size > MAX_FILES) return false;
    if (statSync(file).size > MAX_FILE_SIZE) continue;
    const text = readFileSync(file, "utf8");
    if (PATHS_KEY.test(text)) return true;
    for (const path of namedTsconfigs(text)) {
      const named = namedFile(dirname(file), path);
      if (named !== undefined && !seen.has(named)) {
        seen.add(named);
        queue.push(named);
      }
    }
  }
  return false;
};
