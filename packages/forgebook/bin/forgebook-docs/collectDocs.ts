/**
 * What `forgebook-docs` reads from a package: its exports, their TSDoc and types, its stories, its Sass modules, its
 * style sheets and the design tokens its source declares.
 *
 * @remarks
 * The package's `exports` (the source map, `./src/…`) say what is public; its `*.stories.tsx` say which components
 * exist and where they sit. Components are read with the catalogue's extractor (the props panel's data), modules with
 * TypeScript 6, Sass modules and style sheets from their text. The development-only `./stories` export is left out of
 * the lists; the id and the tokens of the source it declares are read from its text.
 *
 * @module
 */
import { globSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import type { StoryFileIndex } from "@forgebook/story-format/source";

import { figmaLink } from "../../src/figmaLink.ts";
import type { ExtractStoryComponent } from "../../src/vite/adapter.ts";
import { autoTitle, STORY_FILE } from "../../src/vite/autoTitle.ts";
import type { DesignToken } from "../../src/vite/designTokens.ts";
import { readLinkedFile } from "../../src/vite/docPageMarkdown.ts";
import { indexedDocPages } from "../../src/vite/docPagesModule.ts";
import { indexStoryFile } from "../../src/vite/indexStoryFile.ts";
import { readTokenFiles, type SourceTokens, sourceTokensIn } from "../../src/vite/sourceTokens.ts";
import type {
  CatalogueComponent,
  CatalogueData,
  CataloguePage,
  ModuleDocs,
  SassModuleDocs,
  StyleSheetDocs
} from "./catalogueDocs.types.ts";
import { type CatalogueOptions, isExcluded } from "./catalogueOptions.ts";
import { moduleDocs } from "./moduleDocs.ts";
import { sassMembers, styleSheetSummary } from "./sassDocs.ts";

/** What was read, and what could not be. */
export type CollectedDocs = {
  /** The catalogue's data. */
  readonly data: CatalogueData;
  /** One message per thing that could not be read: a file, a token. */
  readonly problems: readonly string[];
};

/** The subpath that is never published: the package's stories for a catalogue. */
const STORIES_SUBPATH = "./stories";

/** A package's `exports`, as written: subpath → source. */
const sourceExports = (manifest: unknown): Readonly<Record<string, string>> => {
  if (typeof manifest !== "object" || manifest === null || !("exports" in manifest)) return {};
  const exports = manifest.exports;
  if (typeof exports !== "object" || exports === null) return {};
  return Object.fromEntries(
    Object.entries(exports).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
};

/**
 * Whether every story of a file is about logic (`parameters.logic`, its own or the meta's): a hook's or a function's.
 *
 * @param index - the file's index.
 */
const isLogicFile = (index: StoryFileIndex): boolean =>
  index.stories.length > 0 && index.stories.every((story) => (story.isLogic ?? index.isLogic) === true);

/**
 * The link to a component's design, when its meta writes a valid one: a wrong one is the catalogue's to report.
 *
 * @param index - the file's index.
 */
const designOf = (index: StoryFileIndex): string | undefined => {
  const link = index.design === undefined ? undefined : figmaLink(index.design.figma);
  return link === undefined || typeof link === "string" ? undefined : link.url;
};

/** The components of the package's story files, read by the framework's extractor. */
const collectComponents = (
  packageDir: string,
  exports: Readonly<Record<string, string>>,
  problems: string[],
  extractStoryComponent: ExtractStoryComponent,
  exclude: readonly string[]
): { components: CatalogueComponent[]; componentFiles: Set<string> } => {
  const components: CatalogueComponent[] = [];
  const componentFiles = new Set<string>();
  const storyFiles = globSync("**/*.stories.*", { cwd: packageDir })
    .filter((file) => STORY_FILE.test(file))
    .filter((file) => !file.split("/").some((segment) => segment === "node_modules" || segment === "dist"))
    .sort();
  for (const relative of storyFiles) {
    const file = join(packageDir, relative);
    // a meta without a title is placed by its path from the package's folder: the catalogue's patterns are not known
    const title = autoTitle("", relative);
    const options = title === undefined ? {} : { autoTitle: title };
    const index: StoryFileIndex | string = indexStoryFile(file, readFileSync(file, "utf8"), options);
    const component = extractStoryComponent(file);
    if (typeof index === "string" || typeof component === "string") {
      problems.push(typeof index === "string" ? index : `${relative}: ${String(component)}`);
      continue;
    }
    if (!("file" in component)) continue;
    const subpath = Object.entries(exports).find(
      ([, source]) => resolve(packageDir, source) === component.file
    )?.[0];
    // a component no subpath exports is a story's own (a foundations page), not part of the package
    if (subpath === undefined || isExcluded(subpath, exclude)) continue;
    componentFiles.add(component.file);
    components.push({
      title: index.title,
      subpath,
      docs: component.docs,
      stories: index.stories.map((story) => story.name ?? story.exportName),
      mainStory: (index.stories.find((story) => story.isMain === true) ?? index.stories[0])?.exportName,
      isLogic: isLogicFile(index),
      design: designOf(index)
    });
  }
  return { components, componentFiles };
};

/** What one export is, read. */
type ReadExport =
  | { readonly kind: "sass"; readonly docs: SassModuleDocs }
  | { readonly kind: "sheet"; readonly docs: StyleSheetDocs }
  | { readonly kind: "module"; readonly docs: ModuleDocs }
  | { readonly kind: "problem"; readonly message: string }
  | { readonly kind: "other" };

/** Reads one export: a Sass module, a style sheet or a module. */
const readExport = (subpath: string, source: string, file: string): ReadExport => {
  if (source.startsWith("./src/scss/")) {
    return { kind: "sass", docs: { subpath, members: sassMembers(readFileSync(file, "utf8")) } };
  }
  if (subpath.endsWith(".css")) {
    return { kind: "sheet", docs: { subpath, summary: styleSheetSummary(readFileSync(file, "utf8")) } };
  }
  if (!/\.tsx?$/.test(source)) return { kind: "other" };
  const docs = moduleDocs(file);
  return typeof docs === "string"
    ? { kind: "problem", message: docs }
    : { kind: "module", docs: { subpath, exports: docs } };
};

/** A text field of the package's manifest (`name`, `description`), or none. */
const manifestText = (manifest: unknown, key: string): string | undefined => {
  if (typeof manifest !== "object" || manifest === null || !(key in manifest)) return undefined;
  const value: unknown = Reflect.get(manifest, key);
  return typeof value === "string" ? value : undefined;
};

/** What the package's `./stories` export declares, its tokens files named from the package's folder. */
const declaredIn = (
  packageDir: string,
  exports: Readonly<Record<string, string>>
): SourceTokens | undefined => {
  const source = exports[STORIES_SUBPATH];
  if (source === undefined) return undefined;
  const declared = sourceTokensIn(resolve(packageDir, source), STORIES_SUBPATH);
  return {
    ...declared,
    files: declared.files.map((file) => ({ ...file, label: relative(packageDir, file.path) }))
  };
};

/** The package's tokens, with what could not be read of them; nothing is read for a section left out. */
const collectTokens = (
  declared: SourceTokens | undefined,
  sections: CatalogueOptions["sections"] | undefined
): { readonly tokens: readonly DesignToken[]; readonly problems: readonly string[] } => {
  if (declared === undefined || sections?.includes("tokens") === false) return { tokens: [], problems: [] };
  const { tokens, problems } = readTokenFiles(declared.files);
  return { tokens, problems: [...declared.problems, ...problems] };
};

/** A `?forgebook-docs-pages` import of a source module: its pattern, before the query. */
const PAGES_IMPORT = /["']([^"']+)\?forgebook-docs-pages["']/g;

/** A page's position: its `order`, or after every page with one. */
const orderOf = (order: number | undefined): number => order ?? Number.POSITIVE_INFINITY;

/**
 * The docs pages a package's `./stories` export declares, read from its `?forgebook-docs-pages` imports, in reading
 * order.
 *
 * @param packageDir - the package's folder.
 * @param exports - its exports.
 * @param problems - receives what the pages' index noticed.
 */
const collectPages = (
  packageDir: string,
  exports: Readonly<Record<string, string>>,
  problems: string[]
): CataloguePage[] => {
  const source = exports[STORIES_SUBPATH];
  if (source === undefined) return [];
  const file = resolve(packageDir, source);
  const patterns = [...(readLinkedFile(file) ?? "").matchAll(PAGES_IMPORT)].flatMap(
    (match) => match[1] ?? []
  );
  const pages = patterns.flatMap((pattern) => indexedDocPages(dirname(file), pattern, (): void => undefined));
  for (const page of pages)
    for (const note of page.index.notes ?? []) problems.push(`${relative(packageDir, page.file)}: ${note}`);
  return pages
    .sort(
      (left, right) =>
        orderOf(left.index.order) - orderOf(right.index.order) ||
        left.index.title.localeCompare(right.index.title)
    )
    .map((page) => ({
      title: page.index.title,
      file: relative(packageDir, page.file).split("\\").join("/"),
      description: page.index.description
    }));
};

/**
 * Reads a package for its catalogue.
 *
 * @param packageDir - the package's folder.
 * @param extractStoryComponent - the framework's reading of a story file's component (its docs module).
 * @param options - the package's catalogue options: the subpaths it leaves out, and the sections it lists, which leave
 *   the tokens unread when they do not name them (every section by default).
 */
export const collectDocs = (
  packageDir: string,
  extractStoryComponent: ExtractStoryComponent,
  options: Pick<CatalogueOptions, "exclude"> & Partial<Pick<CatalogueOptions, "sections">>
): CollectedDocs => {
  const manifest: unknown = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
  const packageName = manifestText(manifest, "name") ?? packageDir;
  const exports = sourceExports(manifest);
  const problems: string[] = [];
  const { components, componentFiles } = collectComponents(
    packageDir,
    exports,
    problems,
    extractStoryComponent,
    options.exclude
  );
  const modules: ModuleDocs[] = [];
  const sassModules: SassModuleDocs[] = [];
  const styleSheets: StyleSheetDocs[] = [];
  for (const [subpath, source] of Object.entries(exports)) {
    const file = resolve(packageDir, source);
    if (subpath === STORIES_SUBPATH || componentFiles.has(file) || isExcluded(subpath, options.exclude))
      continue;
    const entry = readExport(subpath, source, file);
    if (entry.kind === "sass") sassModules.push(entry.docs);
    if (entry.kind === "sheet") styleSheets.push(entry.docs);
    if (entry.kind === "module") modules.push(entry.docs);
    if (entry.kind === "problem") problems.push(entry.message);
  }
  const description = manifestText(manifest, "description");
  const declared = declaredIn(packageDir, exports);
  const { tokens, problems: tokenProblems } = collectTokens(declared, options.sections);
  return {
    data: {
      packageName,
      description,
      sourceId: declared?.id,
      components,
      pages: collectPages(packageDir, exports, problems),
      modules,
      sassModules,
      styleSheets,
      tokens
    },
    problems: [...problems, ...tokenProblems]
  };
};
