/**
 * Where `forgebook new` writes a component's first stories and what they say: the component read from its file by the
 * framework's docs module, the title from the stories file's path, the import beside it. Shared by the command and the
 * MCP tool `new_stories`.
 *
 * @module
 */
import { basename, dirname, join } from "node:path";

import { findUp } from "@ensiria/cli-kit/files";
import { ScriptError } from "@ensiria/cli-kit/script";

import type { CallSite, DocsModule } from "../../src/vite/adapter.ts";
import { autoTitle, patternBase } from "../../src/vite/autoTitle.ts";
import { findConfigFile, loadConfigFile } from "../../src/vite/configFile.ts";
import { isNegated } from "../../src/vite/storyPatterns.ts";
import { VITE_PATHS } from "../../src/vite/vitePaths.ts";
import { frameworkDocsModule } from "../frameworkDocs.ts";
import { newStories, type StoryWrapper } from "./newStories.ts";

/** A component's first stories, ready to write. */
export type NewStoriesFile = {
  /** Where they go: `<Component>.stories.tsx` beside the component, or the framework's own extension. */
  readonly file: string;
  /** The file's text. */
  readonly text: string;
  /** How many places in the application draw the component, whose values the stories took. */
  readonly uses: number;
  /** Why the application's uses could not be read, when they could not: the stories are then written from props alone. */
  readonly usesProblem?: string;
};

/**
 * The folder the title starts from: the catalogue's first stories pattern's (a `!` one lists nothing), else `src` for
 * a file under it.
 */
const titleBase = async (packageDir: string, storiesFile: string): Promise<string> => {
  const config = findConfigFile(packageDir);
  const patterns = config === undefined ? [] : (await loadConfigFile(config)).stories;
  const pattern = patterns.find((each) => !isNegated(each));
  if (pattern !== undefined) return patternBase(pattern).replace(/^\.\//, "");
  return VITE_PATHS.relative(packageDir, storiesFile).split("/")[0] === "src" ? "src" : "";
};

/** The framework of the package's catalogue; React's in a package with none. */
const catalogueFramework = async (packageDir: string): Promise<string> => {
  const config = findConfigFile(packageDir);
  return config === undefined ? "react" : (await loadConfigFile(config)).framework.name;
};

/**
 * Where the application draws a component; why not, when the framework cannot say or reading failed: the stories are then
 * written from its props alone rather than not at all.
 */
const callSites = (docsModule: DocsModule, file: string, name: string): readonly CallSite[] | string => {
  if (docsModule.extractCallSites === undefined) return [];
  try {
    return docsModule.extractCallSites(file, name);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

/**
 * A component's first stories.
 *
 * @param componentFile - the component's file, absolute.
 * @param exportName - the export to read; the file's only component when none.
 * @param framework - the framework the stories are written for (`react`); the catalogue's when none.
 * @param wrappers - components every story is drawn inside (`--repair`); none by default.
 * @throws a `ScriptError` when the file is in no package, the framework cannot read it, or it exports no single
 *   component.
 */
export const newStoriesFile = async (
  componentFile: string,
  exportName: string | undefined,
  framework: string | undefined,
  wrappers: readonly StoryWrapper[] = []
): Promise<NewStoriesFile> => {
  const manifest = findUp("package.json", dirname(componentFile));
  if (manifest === undefined) throw new ScriptError(`${componentFile} is in no package`);
  const packageDir = dirname(manifest);
  const frameworkName = framework ?? (await catalogueFramework(packageDir));
  const docsModule = await frameworkDocsModule(packageDir, frameworkName);
  if (docsModule.extractFileComponent === undefined)
    throw new ScriptError(`@forgebook/${frameworkName} cannot read a component from its file yet`, {
      hint: `Update @forgebook/${frameworkName}`
    });
  const component = docsModule.extractFileComponent(componentFile, exportName);
  if (typeof component === "string") throw new ScriptError(component);
  if (!("file" in component)) throw new ScriptError(`${componentFile} exports no component`);
  const name = component.docs.name;
  const importPath = `./${basename(componentFile).replace(/\.[cm]?[jt]sx?$/, "")}`;
  const shape = docsModule.storyFileShape?.(name, componentFile) ?? {
    extension: ".stories.tsx",
    importStatement: `import ${component.isDefaultExport === true ? name : `{ ${name} }`} from ${JSON.stringify(importPath)};`
  };
  const file = join(dirname(componentFile), `${name}${shape.extension}`);
  // the title is read by `/`, so the path is written with them on Windows too
  const title = autoTitle(await titleBase(packageDir, file), VITE_PATHS.relative(packageDir, file)) ?? name;
  // where the application draws it gives values a reader recognises, where props alone give their names
  const found = callSites(
    docsModule,
    componentFile,
    exportName ?? (component.isDefaultExport === true ? "default" : name)
  );
  const self = VITE_PATHS.normalize(componentFile);
  const uses =
    typeof found === "string" ? [] : found.filter((site) => VITE_PATHS.normalize(site.file) !== self);
  const text = newStories({
    docs: component.docs,
    importStatement: shape.importStatement,
    title,
    typesModule: docsModule.storyTypesModule ?? `@forgebook/${frameworkName}`,
    wrappers,
    uses: uses.map((site) => ({ file: VITE_PATHS.relative(packageDir, site.file), args: site.args }))
  });
  return { file, text, uses: uses.length, ...(typeof found === "string" ? { usesProblem: found } : {}) };
};

/**
 * What `new --json` answers: the file written, and how many of the application's uses it took values from.
 *
 * @param written - the stories written.
 * @param shown - the file as the command names it.
 */
export const newStoriesDocument = (
  written: NewStoriesFile,
  shown: string
): Readonly<Record<string, unknown>> => ({
  schema: 1,
  file: VITE_PATHS.normalize(shown),
  uses: written.uses,
  ...(written.usesProblem === undefined ? {} : { usesProblem: written.usesProblem })
});

/**
 * The end of the line that says a file was written, when its values came from the application.
 *
 * @param uses - how many places draw the component.
 */
export const usesWords = (uses: number): string =>
  uses === 0 ? "" : `, with the values of ${uses} place${uses === 1 ? "" : "s"} that draw it`;
