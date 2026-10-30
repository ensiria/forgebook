/**
 * What `forgebook-docs` reads from a package: its exports, their TSDoc and types, its stories, its Sass modules and
 * style sheets.
 *
 * @remarks
 * The package's `exports` (the source map, `./src/…`) say what is public; its `*.stories.tsx` say which components
 * exist and where they sit. Components are read with the catalogue's extractor (the props panel's data), modules with
 * TypeScript 6, Sass modules and style sheets from their text. The development-only `./stories` export is left out.
 *
 * @module
 */
import { globSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { StoryFileIndex } from "@ensiria/story-format/source";

import { extractStoryComponent } from "../../src/vite/extractDocs.ts";
import { indexStoryFile } from "../../src/vite/indexStoryFile.ts";
import type {
  CatalogueComponent,
  CatalogueData,
  ModuleDocs,
  SassModuleDocs,
  StyleSheetDocs
} from "./catalogueDocs.types.ts";
import { moduleDocs } from "./moduleDocs.ts";
import { sassMembers, styleSheetSummary } from "./sassDocs.ts";

/** What was read, and what could not be. */
export type CollectedDocs = {
  /** The catalogue's data. */
  readonly data: CatalogueData;
  /** One message per file that could not be read. */
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

/** The components of the package's story files. */
const collectComponents = (
  packageDir: string,
  exports: Readonly<Record<string, string>>,
  problems: string[]
): { components: CatalogueComponent[]; componentFiles: Set<string> } => {
  const components: CatalogueComponent[] = [];
  const componentFiles = new Set<string>();
  const storyFiles = globSync("**/*.stories.tsx", { cwd: packageDir })
    .filter((file) => !file.split("/").some((segment) => segment === "node_modules" || segment === "dist"))
    .sort();
  for (const relative of storyFiles) {
    const file = join(packageDir, relative);
    const index: StoryFileIndex | string = indexStoryFile(file, readFileSync(file, "utf8"));
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
    if (subpath === undefined) continue;
    componentFiles.add(component.file);
    components.push({
      title: index.title,
      subpath,
      docs: component.docs,
      stories: index.stories.map((story) => story.name ?? story.exportName)
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

/**
 * Reads a package for its catalogue.
 *
 * @param packageDir - the package's folder.
 */
export const collectDocs = (packageDir: string): CollectedDocs => {
  const manifest: unknown = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
  const packageName =
    typeof manifest === "object" &&
    manifest !== null &&
    "name" in manifest &&
    typeof manifest.name === "string"
      ? manifest.name
      : packageDir;
  const exports = sourceExports(manifest);
  const problems: string[] = [];
  const { components, componentFiles } = collectComponents(packageDir, exports, problems);
  const modules: ModuleDocs[] = [];
  const sassModules: SassModuleDocs[] = [];
  const styleSheets: StyleSheetDocs[] = [];
  for (const [subpath, source] of Object.entries(exports)) {
    const file = resolve(packageDir, source);
    if (subpath === STORIES_SUBPATH || componentFiles.has(file)) continue;
    const entry = readExport(subpath, source, file);
    if (entry.kind === "sass") sassModules.push(entry.docs);
    if (entry.kind === "sheet") styleSheets.push(entry.docs);
    if (entry.kind === "module") modules.push(entry.docs);
    if (entry.kind === "problem") problems.push(entry.message);
  }
  return { data: { packageName, components, modules, sassModules, styleSheets }, problems };
};
