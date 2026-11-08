/**
 * Finds and reads the files that hold an application's design system: `components.json`, the style sheets git knows and
 * what those import from the workspace, and Tailwind's configuration files with their presets.
 *
 * @remarks
 * It only reads: resolving a name reads manifests, and no project code runs. The sheets are the ones git knows and what
 * they import; a third party's sheet is not this application's system. Nothing outside the repository is read, however a
 * file names it (`components.json`, `@import`, a link), and only regular files of the expected kind, since what is read
 * reaches answers and a published agent index, and a link to `/dev/zero` would never end. Reading stops at limits and says
 * so, since a question that takes minutes in a large repository reads as a broken command.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, resolve } from "node:path";

import { type CssReading, readCssText } from "./cssDeclarations.ts";
import { isInside } from "./sourceTokens.ts";
import { readTailwindConfig, type TailwindConfigReading } from "./tailwindConfigTokens.ts";

/** What `components.json` says of a project's system. */
export type ShadcnConfig = {
  /** Its path. */
  readonly file: string;
  /** The sheet with its variables. */
  readonly css: string | undefined;
  /** Its Tailwind configuration file. */
  readonly config: string | undefined;
};

/** One sheet, read. */
export type ReadSheet = {
  /** Its absolute path. */
  readonly file: string;
  /** Its text. */
  readonly text: string;
  /** What it declares. */
  readonly reading: CssReading;
};

/** One configuration file, read. */
export type ReadConfig = {
  /** Its absolute path. */
  readonly file: string;
  /** Its text. */
  readonly text: string;
  /** What it declares. */
  readonly reading: TailwindConfigReading;
};

/** The sheets git is asked for. */
const SHEET_PATTERNS = ["*.css", "*.scss", "*.less", "*.pcss", "*.postcss"];

/** What a relative name may leave out, in the order the tools try them. */
const OMITTED_EXTENSIONS = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".scss", ".sass", ".less", ".css"];

/** A configuration's file name. */
const CONFIG_FILE = /\.(?:[cm]?[jt]s)$/;

/** A sheet's file name. */
const SHEET_FILE = /\.(?:css|scss|less|pcss|postcss)$/;

/** What a sheet's path says is not the application's system: copies, examples, tests and generated output. */
const NOT_THE_SYSTEM =
  /(?:\.min\.|\.stories\.|\.module\.|(?:^|\/)(?:node_modules|dist|build|out|coverage|vendor|vendors|public|static|fixtures?|__fixtures__|tests?|__tests__|e2e|examples?|templates?|\.next|\.nuxt|\.svelte-kit|\.astro|\.turbo|storybook-static)\/)/;

/** Past this a sheet is a bundle or a copy, not something a person wrote. */
const LARGEST_SHEET = 1_000_000;

/** How many sheets are read: enough for any application's system, little enough to stay quick in a large repository. */
const MOST_SHEETS = 400;

/** How long git may take to list them, in milliseconds. */
const LIST_TIMEOUT = 10_000;

/** How many files a walk with no git gives. */
const MOST_WALKED = 20_000;

/** How deep folders are walked with no git to ask. */
const WALK_DEPTH = 12;

/** How deep presets of presets are followed. */
const PRESET_DEPTH = 4;

/** The Tailwind configuration's names, by what they are written in. */
const TAILWIND_CONFIGS = ["ts", "mts", "cts", "js", "mjs", "cjs"].map((each) => `tailwind.config.${each}`);

/**
 * A regular file's text, or none when it is something else, cannot be read or is too large to be written by hand.
 *
 * @param file - its path.
 */
export const smallFileText = (file: string): string | undefined => {
  try {
    const stats = statSync(file);
    return stats.isFile() && stats.size <= LARGEST_SHEET ? readFileSync(file, "utf8") : undefined;
  } catch {
    return undefined;
  }
};

/** Whether a path is a folder and no link to one: a walk that follows links can leave the project or never end. */
const isFolder = (path: string): boolean => {
  try {
    return lstatSync(path).isDirectory();
  } catch {
    return false;
  }
};

/** Whether a path is a file that can be read. */
const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

/** The files of a kind under a folder with no git to ask, sorted, leaving out what no source folder holds. */
const walkedFiles = (dir: string, kind: RegExp, left: RegExp, depth = 0): string[] => {
  if (depth > WALK_DEPTH) return [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir).toSorted();
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry);
    if (entry.startsWith(".") || left.test(`${entry}/`)) return [];
    if (kind.test(entry)) return left.test(entry) ? [] : [path];
    return isFolder(path) ? walkedFiles(path, kind, left, depth + 1) : [];
  });
};

/**
 * The source files of a folder, relative to it: what git tracks and would track, or a walk when this is not a repository.
 *
 * @param dir - the folder.
 * @param patterns - what git is asked for (`*.tsx`).
 * @param kind - the same as a pattern for a file's name, for the walk.
 * @param left - what the walk leaves out, as git would by what it ignores.
 */
export const listedFiles = (
  dir: string,
  patterns: readonly string[],
  kind: RegExp,
  left: RegExp
): string[] => {
  // a repository's configuration may name a program for git to run while listing: nothing here is to run
  const listed = spawnSync(
    "git",
    [
      "-c",
      "core.fsmonitor=false",
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      ...patterns
    ],
    { cwd: dir, encoding: "utf8", timeout: LIST_TIMEOUT, maxBuffer: 64 * 1024 * 1024 }
  );
  if (listed.status === 0) return listed.stdout.split("\0").filter((file) => file !== "");
  return walkedFiles(dir, kind, left)
    .slice(0, MOST_WALKED)
    .map((file) => relative(dir, file).replaceAll("\\", "/"));
};

/** The sheets of a folder, what is not the application's system left out, absolute and in a stable order. */
const listedSheets = (dir: string): string[] =>
  listedFiles(dir, SHEET_PATTERNS, SHEET_FILE, NOT_THE_SYSTEM)
    .filter((file) => !NOT_THE_SYSTEM.test(file))
    .toSorted()
    .map((file) => join(dir, file));

/** Where a name leads: a file of the workspace, nothing of this application's, or nowhere that could be found. */
type Resolved = { readonly file: string } | "third-party" | "missing";

/** What a relative name may leave out: a configuration's extension, a Sass partial's underscore and extension. */
const writtenForms = (path: string): string[] => {
  const folder = dirname(path);
  const name = basename(path);
  return [
    path,
    ...OMITTED_EXTENSIONS.flatMap((extension) => [
      `${path}${extension}`,
      join(folder, `_${name}${extension}`)
    ])
  ];
};

/** A workspace package's sheet by its manifest's `style`, which `exports` need not name. */
const styleOfPackage = (from: string, specifier: string): Resolved | undefined => {
  const manifest = packageFile(dirname(from), join(specifier, "package.json"));
  if (manifest === undefined) return undefined;
  const real = realpathSync(manifest);
  if (real.split(/[\\/]/).includes("node_modules")) return "third-party";
  try {
    const parsed: unknown = JSON.parse(readFileSync(real, "utf8"));
    const style =
      typeof parsed === "object" && parsed !== null && "style" in parsed ? parsed.style : undefined;
    return typeof style === "string" ? { file: resolve(dirname(real), style) } : "third-party";
  } catch {
    return "third-party";
  }
};

/** What a name leads to as far as this reads it: a file outside the repository is nothing of its. */
const inRepository = (found: Resolved, root: string): Resolved =>
  typeof found === "object" && !isInside(root, found.file) ? "third-party" : found;

/** Where a sheet's `@import` or a configuration's preset leads. */
const resolvedName = (from: string, specifier: string, root: string): Resolved => {
  if (/^(?:https?:)?\/\/|^sass:/.test(specifier)) return "third-party";
  const direct = writtenForms(resolve(dirname(from), specifier)).find(isFile);
  if (direct !== undefined) return inRepository({ file: realpathSync(direct) }, root);
  try {
    // `resolve` reads manifests and runs nothing
    const found = realpathSync(createRequire(from).resolve(specifier));
    return found.split(/[\\/]/).includes("node_modules")
      ? "third-party"
      : inRepository({ file: found }, root);
  } catch {
    return inRepository(styleOfPackage(from, specifier) ?? "missing", root);
  }
};

/**
 * The file of a package, looked for from a folder up, as Node finds packages.
 *
 * @param dir - where to start.
 * @param path - the package's name and the path in it.
 */
export const packageFile = (dir: string, path: string): string | undefined => {
  for (let here: string = dir; ; here = dirname(here)) {
    const found = join(here, "node_modules", path);
    if (existsSync(found)) return found;
    if (here === dirname(here)) return undefined;
  }
};

/**
 * The repository a folder is in: the nearest above holding `.git`, or the folder itself in none.
 *
 * @param dir - the folder.
 */
export const repositoryOf = (dir: string): string => {
  for (let here: string = dir; ; here = dirname(here)) {
    if (existsSync(join(here, ".git"))) return here;
    if (here === dirname(here)) return dir;
  }
};

/** A file named from a folder, looking up to the folder that holds `.git`. */
const fileAbove = (dir: string, name: string): string | undefined => {
  for (let here: string = dir; ; here = dirname(here)) {
    const path = join(here, name);
    if (existsSync(path)) return path;
    if (existsSync(join(here, ".git")) || here === dirname(here)) return undefined;
  }
};

/**
 * Reads `components.json`, from a folder up; a file that says nothing plain gives nothing.
 *
 * @param dir - where to start.
 */
export const shadcnConfig = (dir: string): ShadcnConfig | undefined => {
  const file = fileAbove(dir, "components.json");
  if (file === undefined) return undefined;
  const root = repositoryOf(dir);
  const inFolder = (value: unknown): string | undefined => {
    const path = typeof value === "string" && value !== "" ? resolve(dirname(file), value) : undefined;
    return path !== undefined && isInside(root, path) ? path : undefined;
  };
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (typeof parsed !== "object" || parsed === null || !("tailwind" in parsed)) return undefined;
    const { tailwind } = parsed;
    if (typeof tailwind !== "object" || tailwind === null) return undefined;
    return {
      file,
      css: "css" in tailwind ? inFolder(tailwind.css) : undefined,
      config: "config" in tailwind ? inFolder(tailwind.config) : undefined
    };
  } catch {
    return undefined;
  }
};

/** What a sheet's `@import` is: another sheet to read, a line for what was not found, or neither. */
const importedSheet = (dir: string, from: string, specifier: string): { file?: string; unread?: string } => {
  if (/^tailwindcss(?:$|\/)/.test(specifier)) return {};
  const target = resolvedName(from, specifier, repositoryOf(dir));
  if (target === "missing") {
    return {
      unread: `${relative(dir, from)}: @import "${specifier}" not found: are dependencies installed?`
    };
  }
  return target !== "third-party" && SHEET_FILE.test(target.file) ? { file: target.file } : {};
};

/** A field of an object, when the value is one. */
const fieldOf = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null && key in value ? Reflect.get(value, key) : undefined;

/**
 * The sheet a package's manifest gives for `@import` of its bare name, as a bundler looks for it: `exports` (a path, or
 * its `style` condition), then `style`, then `main`; the first that is a sheet.
 */
const manifestStyle = (manifest: string): string | undefined => {
  const text = smallFileText(manifest);
  if (text === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    const exported = fieldOf(parsed, "exports");
    const main = fieldOf(exported, ".") ?? exported;
    const named = [main, fieldOf(main, "style"), fieldOf(parsed, "style"), fieldOf(parsed, "main")].find(
      (each): each is string => typeof each === "string" && SHEET_FILE.test(each)
    );
    return named === undefined ? undefined : resolve(dirname(manifest), named);
  } catch {
    return undefined;
  }
};

/** What an `@import` brings that declares no custom property: Sass's own modules, a font service's sheet. */
const DECLARES_NOTHING = /^sass:|^(?:https?:)?\/\/(?:fonts\.|use\.typekit\.net\/)/;

/** A package's name and a path in it, with nothing that climbs or starts elsewhere: `@scope/name/dist/x.css`. */
const BARE_SPECIFIER = /^(?:@[\w-][\w.-]*\/)?[\w-][\w.-]*(?:\/[\w-][\w.@-]*)*$/;

/** A file's real path when it is a sheet inside a folder, the folder's links followed too; none otherwise. */
const sheetInside = (file: string | undefined, folder: string): string | undefined => {
  if (file === undefined || !SHEET_FILE.test(file) || !isFile(file)) return undefined;
  const real = realpathSync(file);
  return isInside(realpathSync(folder), real) ? real : undefined;
};

/**
 * An installed package's sheet that an `@import` names, found on disk as a bundler would; none when it is not one. Only a
 * bare name is followed, and only to a sheet inside its package, itself inside the repository: a manifest's field or a
 * name that climbs (`x/../../y`) must not make the check read a file of the machine.
 */
const installedSheet = (from: string, specifier: string, root: string): string | undefined => {
  if (!BARE_SPECIFIER.test(specifier)) return undefined;
  const folder = dirname(from);
  const nameLength = specifier.startsWith("@") ? 2 : 1;
  const name = specifier.split("/").slice(0, nameLength).join("/");
  const packageDir = packageFile(folder, name);
  // a package manager links packages in (pnpm), so the folder is where the link leads, and it stays in the repository
  if (
    packageDir === undefined ||
    !statSync(packageDir).isDirectory() ||
    !isInside(root, realpathSync(packageDir))
  ) {
    return undefined;
  }
  if (name === "tailwindcss") return sheetInside(join(packageDir, "theme.css"), packageDir);
  if (name !== specifier) {
    // a path in a package, written whole or without the sheet's extension, as bundlers allow
    const path = join(packageDir, specifier.slice(name.length));
    return sheetInside(path, packageDir) ?? sheetInside(`${path}.css`, packageDir);
  }
  return sheetInside(manifestStyle(join(packageDir, "package.json")), packageDir);
};

/** An imported package sheet's text; `read` when it is a sheet of the workspace, read with the application's own. */
const packageSheetText = (from: string, specifier: string, root: string): string | "read" | undefined => {
  // what is missing may still be a package's, so only a sheet of the workspace is passed over
  const isRead =
    !/^tailwindcss(?:$|\/)/.test(specifier) && typeof resolvedName(from, specifier, root) === "object";
  if (isRead) return "read";
  const sheet = installedSheet(from, specifier, root);
  return sheet === undefined ? undefined : smallFileText(sheet);
};

/**
 * The sheets of installed packages that the application's sheets import, for the custom properties they declare: a
 * reference to one of those has a value, though it is no token of this application's.
 *
 * @param dir - the catalogue's folder.
 * @param sheets - the sheets read.
 * @returns the texts found, and what each import that could not be read was called, a missing one included.
 */
export const importedPackageSheets = (
  dir: string,
  sheets: readonly ReadSheet[]
): { readonly texts: readonly string[]; readonly unreadable: readonly string[] } => {
  const root = repositoryOf(dir);
  const texts: string[] = [];
  const unreadable = new Set<string>();
  const seen = new Set<string>();
  const imports = sheets.flatMap(({ file, reading }) =>
    reading.imports.map((specifier) => ({ file, specifier }))
  );
  for (const { file, specifier } of imports) {
    // each package once, and a sheet that imports thousands reads no more than the sheets themselves do
    const key = `${dirname(file)}\0${specifier}`;
    if (seen.has(key) || seen.size >= MOST_SHEETS || DECLARES_NOTHING.test(specifier)) continue;
    seen.add(key);
    const text = packageSheetText(file, specifier, root);
    if (text === undefined) unreadable.add(specifier);
    else if (text !== "read") texts.push(text);
  }
  return { texts, unreadable: [...unreadable] };
};

/**
 * Reads a catalogue's sheets, the one `components.json` names first, and what they import from the workspace, each once.
 *
 * @param dir - the catalogue's folder.
 * @param shadcn - what `components.json` says.
 * @param unread - told of what is left out.
 */
export const readSheets = (dir: string, shadcn: ShadcnConfig | undefined, unread: string[]): ReadSheet[] => {
  const listed = listedSheets(dir);
  if (listed.length > MOST_SHEETS)
    unread.push(`${listed.length - MOST_SHEETS} style sheets past the first ${MOST_SHEETS} not read`);
  const seen = new Set<string>();
  const sheets: ReadSheet[] = [];
  const read = (file: string): void => {
    const text = seen.has(file) ? undefined : smallFileText(file);
    seen.add(file);
    if (text === undefined) return;
    const reading = readCssText(text);
    for (const specifier of reading.imports) {
      const found = importedSheet(dir, file, specifier);
      if (found.unread !== undefined) unread.push(found.unread);
      if (found.file !== undefined) read(found.file);
    }
    // after what it imports, so what it declares stands over it, as in a browser
    sheets.push({ file, text, reading });
  };
  const root = repositoryOf(dir);
  for (const entry of [...(shadcn?.css === undefined ? [] : [shadcn.css]), ...listed.slice(0, MOST_SHEETS)]) {
    // a tracked link may lead anywhere
    if (existsSync(entry) && isInside(root, entry)) read(realpathSync(entry));
  }
  return sheets;
};

/** A configuration and the presets it names, the presets first, as Tailwind merges them. */
const readConfig = (
  file: string,
  depth: number,
  seen: Set<string>,
  unread: (line: string) => void
): ReadConfig[] => {
  if (depth > PRESET_DEPTH || seen.has(file) || !CONFIG_FILE.test(file)) return [];
  seen.add(file);
  const text = smallFileText(file);
  if (text === undefined) return [];
  const reading = readTailwindConfig(file, text);
  const presets = reading.presets.flatMap((specifier) => {
    const target = resolvedName(file, specifier, repositoryOf(dirname(file)));
    if (typeof target === "object") return readConfig(target.file, depth + 1, seen, unread);
    if (target === "missing") unread(`preset "${specifier}" not found: are dependencies installed?`);
    return [];
  });
  return [...presets, { file, reading, text }];
};

/**
 * Reads a catalogue's Tailwind configurations: what `components.json` and the sheets name, and the one in its folder.
 *
 * @param dir - the catalogue's folder.
 * @param shadcn - what `components.json` says.
 * @param sheets - the sheets read, for their `@config`s.
 * @param unread - told of what is left out.
 */
export const readConfigs = (
  dir: string,
  shadcn: ShadcnConfig | undefined,
  sheets: readonly ReadSheet[],
  unread: string[]
): ReadConfig[] => {
  const named = sheets.flatMap(({ file, reading }) =>
    reading.configs.flatMap((name) => {
      const target = resolvedName(file, name, repositoryOf(dir));
      return typeof target === "object" ? [target.file] : [];
    })
  );
  const files = [
    ...(shadcn?.config === undefined ? [] : [shadcn.config]),
    ...named,
    ...TAILWIND_CONFIGS.flatMap((name) => fileAbove(dir, name) ?? [])
  ];
  const seen = new Set<string>();
  return files.flatMap((file) =>
    readConfig(file, 0, seen, (line) => {
      unread.push(`${relative(dir, file)}: ${line}`);
    })
  );
};
