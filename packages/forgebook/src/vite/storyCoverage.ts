/**
 * Which of a project's components have stories and which are drawn by its code: what `forgebook audit` reports as a
 * catalogue's rot, components no story is about and stories of components nothing uses.
 *
 * @remarks
 * Read from the files' text, with no program and no configuration, like the rest of the audit: it has to answer on a
 * project with no catalogue, in a moment. A story file is about the components it imports; a component is used when a file
 * that is neither a story nor a test imports it or writes its tag. Where an import cannot be followed (a barrel, an alias,
 * a package's name), the imported name stands for every exported component of that name. Each guess leans the same way,
 * towards "has stories" and "is used", so a component is listed only when nothing in the project could be it: a list here
 * is worth reading, and a short one is not a promise. A component a framework loads by its file's place (a page, a layout)
 * is in neither list, and stories of a published package's components never count as unused, since what uses them is
 * outside the repository.
 *
 * @module
 */
import type { ScannedComponent } from "./componentScan.ts";
import { exportAliasesOf, type ImportedName, importsOf } from "./importedNames.ts";
import type { ProjectFile } from "./projectFiles.ts";

/** A component as a list of the report names it. */
export type CoverageComponent = Pick<ScannedComponent, "name" | "file" | "line">;

/** A component with stories that nothing outside stories and tests draws. */
export type UnusedStoriedComponent = CoverageComponent & {
  /** The story files about it. */
  readonly storyFiles: readonly string[];
};

/** Which components have stories, and which of those the project draws. */
export type StoryCoverage = {
  /** How many story files were read. */
  readonly storyFileCount: number;
  /** How many exported components some story is about. */
  readonly withStories: number;
  /** Exported components no story file is about, pages and layouts left out. */
  readonly withoutStories: readonly CoverageComponent[];
  /** Components with stories that no file other than a story or a test imports or draws. */
  readonly storiesUnused: readonly UnusedStoriedComponent[];
  /** How many components with stories were not judged unused because their package is published. */
  readonly published: number;
};

/** A story file, in any language a catalogue reads. */
export const STORY_FILE = /\.(?:stories|story)\.[cm]?[jt]sx?$|\.(?:stories|story)\.(?:vue|svelte|astro)$/;

/**
 * What is never the project's own use of a component: test files by their names, and the folders only tools read. A folder
 * merely named `tests` may be the application's own (a quiz's `tests/`), so only a file's name says it is a test.
 */
const NOT_A_USE =
  /\.(?:test|spec|e2e|cy)\.|(?:^|\/)(?:__tests__|__stories__|__mocks__|\.storybook|\.forgebook)\//;

/**
 * A file a framework loads by its place: a route, a page, a layout, an application's entry. Nothing imports it, and no one
 * owes it a story.
 */
const LOADED_BY_PLACE =
  /(?:^|\/)(?:pages|routes|layouts)\/|(?:^|\/)(?:\+page|\+layout|\+error|page|layout|template|loading|error|not-found|default|global-error|_app|_document|App|app|main|root|entry\.client|entry\.server)\.[^/]+$/;

/** The extensions an import may leave out, in the order a bundler tries them. */
const EXTENSIONS = ["", ".tsx", ".ts", ".jsx", ".js", ".mts", ".mjs", ".vue", ".svelte", ".astro"] as const;

/** A prefix projects give their source folder in imports: `@/components/Button`. */
const ALIAS = /^(?:@|~|~~|@@|#|\$lib)\//;

/** A tag written in markup: `<Button`, `<my-button`; a namespace's `<UI.Button>` is read with its import. */
const TAG = /<([A-Z][\w$]*|[a-z][\w]*(?:-[\w]+)+)/g;

/** An extension an ES module's import writes for a TypeScript file: `./Button.js` is `Button.tsx`. */
const WRITTEN_EXTENSION = /\.[cm]?jsx?$/;

/** A path with its `.` and `..` folded away. */
const folded = (path: string): string => {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== "." && part !== "") parts.push(part);
  }
  return parts.join("/");
};

/** A path without its extension, as an import may write it. */
const bare = (file: string): string => file.replace(/\.[^./]+$/, "").replace(/\/index$/, "");

/**
 * The project file an import names, when one can be told: a relative path, or an alias whose path one file ends with.
 *
 * @param specifier - the import's module.
 * @param from - the importing file.
 * @param known - the project's files.
 * @param bySuffix - the project's files by every tail of their path without extension.
 */
const resolved = (
  specifier: string,
  from: string,
  known: ReadonlySet<string>,
  bySuffix: ReadonlyMap<string, readonly string[]>
): string | undefined => {
  if (specifier.startsWith(".")) {
    const written = folded(`${from.split("/").slice(0, -1).join("/")}/${specifier}`);
    const bases = WRITTEN_EXTENSION.test(written)
      ? [written, written.replace(WRITTEN_EXTENSION, "")]
      : [written];
    for (const form of bases.flatMap((base) => [base, `${base}/index`])) {
      for (const extension of EXTENSIONS) if (known.has(`${form}${extension}`)) return `${form}${extension}`;
    }
    return undefined;
  }
  if (!ALIAS.test(specifier)) return undefined;
  const files = bySuffix.get(bare(specifier.replace(ALIAS, "").replace(WRITTEN_EXTENSION, ""))) ?? [];
  return files.length === 1 ? files[0] : undefined;
};

/** The project's files by every tail of their path without extension, `a/b/c` under `a/b/c`, `b/c` and `c`. */
const suffixIndex = (files: Iterable<string>): Map<string, string[]> => {
  const index = new Map<string, string[]>();
  for (const file of files) {
    const parts = bare(file).split("/");
    for (let start = 0; start < parts.length; start += 1) {
      const suffix = parts.slice(start).join("/");
      const listed = index.get(suffix);
      if (listed === undefined) index.set(suffix, [file]);
      else if (!listed.includes(file)) listed.push(file);
    }
  }
  return index;
};

/** A key for a component: its file and name. */
const keyOf = ({ file, name }: Pick<ScannedComponent, "file" | "name">): string => `${file}\0${name}`;

/** A kebab tag's component name: `my-button` is `MyButton`. */
const pascal = (tag: string): string =>
  tag
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("");

/** The components an import of one file reaches, by what the file declares and, failing that, by name. */
const reached = (
  name: ImportedName,
  target: string | undefined,
  lookup: Lookup
): readonly ScannedComponent[] => {
  const { inFile, byName } = lookup;
  const declared = target === undefined ? [] : (inFile.get(target) ?? []);
  if (name.imported === "*" && declared.length > 0) return declared;
  // `export { Root as Dialog }`: the scan knows the component as Root
  const local =
    (target === undefined ? undefined : lookup.aliasesOf(target).get(name.imported)) ?? name.imported;
  const own = declared.filter((each) =>
    name.imported === "default" ? each.isDefault === true || declared.length === 1 : each.name === local
  );
  if (own.length > 0) return own;
  // a barrel, an alias or a package: the name stands for every exported component of that name
  const asNamed = name.imported === "default" || name.imported === "*" ? name.local : name.imported;
  return byName.get(asNamed) ?? [];
};

/** Groups a list by a key. */
const grouped = <T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(key(item));
    if (group === undefined) groups.set(key(item), [item]);
    else group.push(item);
  }
  return groups;
};

/** What a reading of the files looks up: the project's files and its components, by file and by name. */
type Lookup = {
  /** The files read. */
  readonly known: ReadonlySet<string>;
  /** The same, by every tail of their path without extension. */
  readonly bySuffix: ReadonlyMap<string, readonly string[]>;
  /** The components, by their file. */
  readonly inFile: ReadonlyMap<string, readonly ScannedComponent[]>;
  /** The exported components, by their name. */
  readonly byName: ReadonlyMap<string, readonly ScannedComponent[]>;
  /** The names a file exports its declarations under, when they differ from the declared ones. */
  readonly aliasesOf: (file: string) => ReadonlyMap<string, string>;
};

/** The components a file imports. */
const importedComponents = (file: string, text: string, lookup: Lookup): ScannedComponent[] =>
  importsOf(text).flatMap(({ specifier, names }) => {
    const target = resolved(specifier, file, lookup.known, lookup.bySuffix);
    return names.flatMap((name) => reached(name, target, lookup));
  });

/** The components a file writes the tag of, among those exported and its own. */
const taggedComponents = (file: string, text: string, lookup: Lookup): ScannedComponent[] =>
  [...text.matchAll(TAG)].flatMap((match) => {
    const tag = match[1] ?? "";
    const name = tag.includes("-") ? pascal(tag) : tag;
    return [...(lookup.byName.get(name) ?? []), ...(lookup.inFile.get(file) ?? [])].filter(
      (component) => component.name === name
    );
  });

/** Which story files are about each component, and which components the rest of the files use, by key. */
const readUses = (
  files: readonly ProjectFile[],
  lookup: Lookup
): { readonly storiedBy: ReadonlyMap<string, ReadonlySet<string>>; readonly used: ReadonlySet<string> } => {
  const storiedBy = new Map<string, Set<string>>();
  const used = new Set<string>();
  for (const { file, text } of files) {
    if (STORY_FILE.test(file)) {
      for (const component of importedComponents(file, text, lookup)) {
        const key = keyOf(component);
        storiedBy.set(key, (storiedBy.get(key) ?? new Set()).add(file));
      }
    } else if (!NOT_A_USE.test(file)) {
      for (const component of importedComponents(file, text, lookup)) used.add(keyOf(component));
      for (const component of taggedComponents(file, text, lookup)) used.add(keyOf(component));
    }
  }
  return { storiedBy, used };
};

/** A component as a list names it. */
const listed = ({ name, file, line }: ScannedComponent): CoverageComponent => ({ name, file, line });

/**
 * Which of a project's components have stories, and which of those its code draws.
 *
 * @param components - the project's components (`projectComponents`).
 * @param files - every file read: components, story files and scripts that may import them.
 * @param isPublished - whether a file belongs to a package the repository publishes.
 */
export const storyCoverage = (
  components: readonly ScannedComponent[],
  files: readonly ProjectFile[],
  isPublished: (file: string) => boolean
): StoryCoverage => {
  const known = new Set(files.map(({ file }) => file));
  const texts = new Map(files.map(({ file, text }) => [file, text]));
  const aliases = new Map<string, ReadonlyMap<string, string>>();
  const aliasesOf = (file: string): ReadonlyMap<string, string> => {
    const found = aliases.get(file) ?? exportAliasesOf(texts.get(file) ?? "");
    aliases.set(file, found);
    return found;
  };
  const { storiedBy, used } = readUses(files, {
    known,
    bySuffix: suffixIndex(known),
    aliasesOf,
    inFile: grouped(components, ({ file }) => file),
    byName: grouped(
      components.filter(({ isExported }) => isExported),
      ({ name }) => name
    )
  });
  const hasStories = (each: ScannedComponent): boolean => storiedBy.has(keyOf(each));
  const placed = components.filter(({ file }) => !LOADED_BY_PLACE.test(file));
  const unused = placed.filter((each) => hasStories(each) && !used.has(keyOf(each)));
  return {
    storyFileCount: files.filter(({ file }) => STORY_FILE.test(file)).length,
    withStories: components.filter((each) => each.isExported && hasStories(each)).length,
    withoutStories: placed.filter((each) => each.isExported && !hasStories(each)).map(listed),
    storiesUnused: unused
      .filter(({ file }) => !isPublished(file))
      .map((each) => ({ ...listed(each), storyFiles: [...(storiedBy.get(keyOf(each)) ?? [])].toSorted() })),
    published: unused.filter(({ file }) => isPublished(file)).length
  };
};
