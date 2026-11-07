/**
 * Which source files a package publishes: its manifest's entries, led back from the build they name to the file they
 * are built from.
 *
 * @remarks
 * Pure. A manifest names what is built (`./dist/index.js`), which a fresh clone does not hold and an agent never reads, so
 * each entry is looked for under `src` by what is left of its path once the build's folders are taken off, the longest
 * rest first (`dist/esm/button/index.js` is `src/dist/esm/button/index`, then `src/esm/button/index`, then `src/button/index`, each
 * under `src/js` too, where a JavaScript library may keep its sources). What cannot be led back is
 * named, and never read as a package with nothing in it. A private package counts only when it has an entry to
 * import: a workspace's shared library is published to its neighbours, while an application or a monorepo's root is not.
 *
 * @module
 */

/** The extensions an entry's source may have, the likeliest first. */
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".jsx", ".js", ".mjs", ".vue", ".svelte"] as const;

/** A file a manifest may name that has no components to follow. */
const NOT_CODE = /\.(?:css|scss|sass|less|json|svg|png|d\.[cm]?ts|map)$/;

/** A file a pattern's folder holds that no one imports from the package: its stories and tests. */
const NOT_PUBLISHED = /\.(?:stories|test|spec)\.[^/]+$|(?:^|\/)__(?:tests|stories|mocks)__\//;

/** A file that is written by hand wherever it sits: a JavaScript file may be a build's. */
const WRITTEN_SOURCE = /\.(?:[cm]?tsx?|jsx|vue|svelte)$/;

/** The condition-free form of a package's fields, as JSON gives them. */
type Manifest = Readonly<Record<string, unknown>>;

/** What a package publishes. */
export type PackageEntries = {
  /** The entries' source files, absolute. */
  readonly entries: readonly string[];
  /** The entries that could not be led back to a source, as the manifest writes them. */
  readonly unread: readonly string[];
};

/** What `packageEntries` asks of the disk. */
export type EntryDisk = {
  /** Whether a file exists, by its absolute path. */
  readonly exists: (file: string) => boolean;
  /** Every file under a folder, absolute; none when it does not exist. */
  readonly filesUnder: (folder: string) => readonly string[];
};

/** Whether a value is a plain object. */
const isManifest = (value: unknown): value is Manifest =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Every path an `exports` value leads to, whatever its conditions. */
const exportTargets = (value: unknown): readonly string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(exportTargets);
  return isManifest(value) ? Object.values(value).flatMap(exportTargets) : [];
};

/**
 * The paths a manifest names, with no duplicates. A path climbing out of the package is left to be named as unread: Node
 * refuses one, and following it would read what the repository does not hold.
 */
const namedPaths = (manifest: Manifest): readonly string[] => {
  const fields = [manifest["source"], manifest["svelte"], manifest["module"], manifest["main"]].filter(
    (each) => typeof each === "string"
  );
  return [...new Set([...exportTargets(manifest["exports"]), ...fields])].filter(
    (each) => !NOT_CODE.test(each)
  );
};

/** Whether a path a manifest names climbs out of its package. */
const climbsOut = (path: string): boolean => path.split("/").includes("..");

/**
 * Whether a package publishes anything: public, or private with an entry its neighbours import.
 *
 * @param manifest - the package's manifest.
 */
export const isPublished = (manifest: unknown): boolean => {
  if (!isManifest(manifest) || typeof manifest["name"] !== "string") return false;
  if (manifest["private"] !== true) return true;
  return manifest["exports"] !== undefined || manifest["source"] !== undefined;
};

/** A path's folders and its name without its extension. */
const withoutExtension = (path: string): string => path.replace(/^\.\//, "").replace(/\.[cm]?[jt]sx?$/, "");

/** The first source file a path with no extension is, as a file or a folder's index. */
const sourceAt = (bare: string, exists: EntryDisk["exists"]): string | undefined => {
  for (const form of [bare, `${bare}/index`]) {
    for (const extension of SOURCE_EXTENSIONS) {
      if (exists(`${form}${extension}`)) return `${form}${extension}`;
    }
  }
  return undefined;
};

/** The source of a built path: under `src`, by the longest rest of the path that is there. */
const builtFrom = (path: string, dir: string, exists: EntryDisk["exists"]): string | undefined => {
  const parts = withoutExtension(path).split("/");
  for (let start = 0; start < parts.length; start += 1) {
    const rest = parts.slice(start).join("/");
    const found = sourceAt(`${dir}/src/${rest}`, exists) ?? sourceAt(`${dir}/src/js/${rest}`, exists);
    if (found !== undefined) return found;
  }
  return undefined;
};

/** The sources a `./dist/*.js` pattern stands for: every source under the folder the pattern's start leads to. */
const patternSources = (path: string, dir: string, disk: EntryDisk): readonly string[] => {
  const [start = ""] = path.split("*");
  const parts = start.replace(/^\.\//, "").split("/").slice(0, -1);
  for (let from = 0; from <= parts.length; from += 1) {
    const rest = parts.slice(from).join("/");
    const folder = from === 0 ? `${dir}/${rest}` : `${dir}/src${rest === "" ? "" : `/${rest}`}`;
    const inSource = disk.filesUnder(folder);
    const sources = inSource.filter(
      (file) => WRITTEN_SOURCE.test(file) && !NOT_CODE.test(file) && !NOT_PUBLISHED.test(file)
    );
    if (sources.length > 0) return sources;
  }
  return [];
};

/** The sources one path a manifest names stands for: none when it cannot be led back. */
const sourcesOf = (path: string, dir: string, disk: EntryDisk): readonly string[] => {
  if (climbsOut(path)) return [];
  if (path.includes("*")) return patternSources(path, dir, disk);
  const named = `${dir}/${path.replace(/^\.\//, "")}`;
  if (disk.exists(named) && WRITTEN_SOURCE.test(named)) return [named];
  const built = builtFrom(path, dir, disk.exists);
  if (built !== undefined) return [built];
  return disk.exists(named) ? [named] : [];
};

/**
 * What a package publishes, as source files.
 *
 * @param manifest - the package's manifest.
 * @param dir - its folder, absolute, with no trailing slash.
 * @param disk - what is asked of the disk.
 */
export const packageEntries = (manifest: unknown, dir: string, disk: EntryDisk): PackageEntries => {
  if (!isManifest(manifest)) return { entries: [], unread: [] };
  const paths = namedPaths(manifest);
  // a manifest with no entries at all means an index, as Node reads it
  if (paths.length === 0) {
    const index = sourceAt(`${dir}/src/index`, disk.exists) ?? sourceAt(`${dir}/index`, disk.exists);
    return { entries: index === undefined ? [] : [index], unread: [] };
  }
  const found = paths.map((path) => ({ path, sources: sourcesOf(path, dir, disk) }));
  return {
    entries: [...new Set(found.flatMap(({ sources }) => sources))],
    unread: found.filter(({ sources }) => sources.length === 0).map(({ path }) => path)
  };
};
