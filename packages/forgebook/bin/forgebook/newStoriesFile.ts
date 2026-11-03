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

import { autoTitle, patternBase } from "../../src/vite/autoTitle.ts";
import { findConfigFile, loadConfigFile } from "../../src/vite/configFile.ts";
import { VITE_PATHS } from "../../src/vite/vitePaths.ts";
import { frameworkDocsModule } from "../frameworkDocs.ts";
import { newStories } from "./newStories.ts";

/** A component's first stories, ready to write. */
export type NewStoriesFile = {
  /** Where they go: `<Component>.stories.tsx` beside the component. */
  readonly file: string;
  /** The file's text. */
  readonly text: string;
};

/** The folder the title starts from: the catalogue's first stories pattern's, else `src` for a file under it. */
const titleBase = async (packageDir: string, storiesFile: string): Promise<string> => {
  const config = findConfigFile(packageDir);
  const [pattern] = config === undefined ? [] : (await loadConfigFile(config)).stories;
  if (pattern !== undefined) return patternBase(pattern).replace(/^\.\//, "");
  return VITE_PATHS.relative(packageDir, storiesFile).split("/")[0] === "src" ? "src" : "";
};

/**
 * A component's first stories.
 *
 * @param componentFile - the component's file, absolute.
 * @param exportName - the export to read; the file's only component when none.
 * @param framework - the framework the stories are written for (`react`).
 * @throws a `ScriptError` when the file is in no package, the framework cannot read it, or it exports no single
 *   component.
 */
export const newStoriesFile = async (
  componentFile: string,
  exportName: string | undefined,
  framework: string
): Promise<NewStoriesFile> => {
  const manifest = findUp("package.json", dirname(componentFile));
  if (manifest === undefined) throw new ScriptError(`${componentFile} is in no package`);
  const packageDir = dirname(manifest);
  const docsModule = await frameworkDocsModule(packageDir, framework);
  if (docsModule.extractFileComponent === undefined)
    throw new ScriptError(`@forgebook/${framework} cannot read a component from its file yet`, {
      hint: `Update @forgebook/${framework}`
    });
  const component = docsModule.extractFileComponent(componentFile, exportName);
  if (typeof component === "string") throw new ScriptError(component);
  if (!("file" in component)) throw new ScriptError(`${componentFile} exports no component`);
  const name = component.docs.name;
  const file = join(dirname(componentFile), `${name}.stories.tsx`);
  // the title is read by `/`, so the path is written with them on Windows too
  const title = autoTitle(await titleBase(packageDir, file), VITE_PATHS.relative(packageDir, file)) ?? name;
  const text = newStories({
    docs: component.docs,
    importPath: `./${basename(componentFile).replace(/\.[cm]?[jt]sx?$/, "")}`,
    title,
    typesModule: docsModule.storyTypesModule ?? `@forgebook/${framework}`
  });
  return { file, text };
};
