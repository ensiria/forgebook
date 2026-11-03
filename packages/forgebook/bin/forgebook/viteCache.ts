/**
 * Where Vite keeps a catalogue's cache, found without loading Vite: the command's servers keep theirs inside it
 * (`commandServer.ts`), and a first start's pre-bundling looks there for what it already did (`prebundleStart.ts`).
 *
 * @module
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** The nearest folder at or above `dir` holding a `package.json`, as Vite looks for the project's package. */
const nearestPackageDir = (dir: string): string | undefined => {
  for (let at: string = dir; ; at = dirname(at)) {
    if (existsSync(join(at, "package.json"))) return at;
    if (dirname(at) === at) return undefined;
  }
};

/** The parts of a Vite configuration that place its cache folder. */
export type CachePlacing = {
  /** The root; the working folder when none. */
  readonly root?: string;
  /** The cache folder set, relative to the root; Vite's default when none. */
  readonly cacheDir?: string;
  /** Whether links are kept as they are, which keeps the root unresolved too. */
  readonly resolve?: { readonly preserveSymlinks?: boolean };
};

/** The root as Vite resolves it: through links unless the configuration keeps them, as the cache folder is found. */
const viteRoot = (current: CachePlacing): string => {
  const root = resolve(current.root ?? process.cwd());
  if (current.resolve?.preserveSymlinks === true || !existsSync(root)) return root;
  return realpathSync(root);
};

/**
 * The cache folder Vite would use for a configuration: the one set, else Vite's default (`node_modules/.vite` of the
 * nearest package, else of the root, else `.vite` in the root).
 *
 * @param current - the configuration so far, with what every other plugin set.
 */
export const viteCacheDir = (current: CachePlacing): string => {
  const root = viteRoot(current);
  if (current.cacheDir !== undefined) return resolve(root, current.cacheDir);
  const packageDir = nearestPackageDir(root);
  if (packageDir !== undefined) return join(packageDir, "node_modules", ".vite");
  const modules = join(root, "node_modules");
  return existsSync(modules) ? join(modules, ".vite") : join(root, ".vite");
};

/**
 * The file a first start's pre-bundling writes the imports it could not resolve in, which every later server of the
 * catalogue leaves out as the pre-bundling did (`prebundleRun.ts`).
 *
 * @param root - the catalogue's folder.
 */
export const unresolvedFile = (root: string): string =>
  join(viteCacheDir({ root }), "forgebook", "unresolved.json");

/** The lock files Vite reads to tell whether the installed packages changed, the first found from the root up. */
const LOCK_FILES = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb", "deno.lock"];

/**
 * The stamp of the installed packages: the nearest lock file's name, change time and size; empty without one. An
 * install changes it, as it changes Vite's pre-bundle hash.
 *
 * @param root - the catalogue's folder.
 */
export const installStamp = (root: string): string => {
  for (let at: string = resolve(root); ; at = dirname(at)) {
    for (const name of LOCK_FILES) {
      const stats = statSync(join(at, name), { throwIfNoEntry: false });
      if (stats !== undefined) return `${join(at, name)}:${stats.mtimeMs}:${stats.size}`;
    }
    if (dirname(at) === at) return "";
  }
};

/** What the pre-bundling writes: the imports left out, and the installed packages they were found missing from. */
type UnresolvedRecord = {
  /** The installed packages' stamp (`installStamp`). */
  readonly installed: string;
  /** The imports left out. */
  readonly imports: readonly string[];
};

/**
 * Whether a value read from the file is what the pre-bundling writes.
 *
 * @param value - the file's JSON.
 */
const isUnresolvedRecord = (value: unknown): value is UnresolvedRecord =>
  typeof value === "object" &&
  value !== null &&
  "installed" in value &&
  typeof value.installed === "string" &&
  "imports" in value &&
  Array.isArray(value.imports) &&
  value.imports.every((name) => typeof name === "string");

/**
 * The imports a first start's pre-bundling could not resolve, while the installed packages are those it found them
 * missing from: after an install Vite pre-bundles again, and an import that resolves now is pre-bundled like any
 * other, since Vite serves one left out as it is and a CommonJS package would not load. None when it resolved them
 * all, or wrote nothing.
 *
 * @param root - the catalogue's folder.
 */
export const unresolvedImports = (root: string): readonly string[] => {
  const file = unresolvedFile(root);
  if (!existsSync(file)) return [];
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    // a file written halfway, or by hand: as if none were left out
    return [];
  }
  return isUnresolvedRecord(value) && value.installed === installStamp(root) ? value.imports : [];
};

/**
 * Keeps the imports the pre-bundling left out, with the installed packages' stamp.
 *
 * @param root - the catalogue's folder.
 * @param imports - the imports.
 */
export const keepUnresolved = (root: string, imports: readonly string[]): void => {
  const file = unresolvedFile(root);
  mkdirSync(dirname(file), { recursive: true });
  const record: UnresolvedRecord = { installed: installStamp(root), imports };
  writeFileSync(file, JSON.stringify(record));
};
