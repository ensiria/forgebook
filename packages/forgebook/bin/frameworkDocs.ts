/**
 * The framework's docs module (`@forgebook/<framework>/docs`), resolved from a package as that package resolves it:
 * what `forgebook docs` and `forgebook new` read components with, in a library that has no catalogue configuration.
 *
 * @module
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { ScriptError } from "@ensiria/cli-kit/script";

import { type DocsModule, isDocsModule } from "../src/vite/adapter.ts";

/**
 * The framework's docs module, from the package that declares the framework package.
 *
 * @param packageDir - the package's folder.
 * @param framework - the framework's name (`react`).
 * @throws a `ScriptError` when the package cannot resolve it or the module is not a docs module.
 */
export const frameworkDocsModule = async (packageDir: string, framework: string): Promise<DocsModule> => {
  const specifier = `@forgebook/${framework}/docs`;
  let file: string;
  try {
    file = createRequire(join(packageDir, "package.json")).resolve(specifier);
  } catch {
    throw new ScriptError(`${specifier} is not installed in this package`, {
      hint: `Add @forgebook/${framework} to its devDependencies`
    });
  }
  const module: unknown = await import(pathToFileURL(file).href);
  if (!isDocsModule(module)) throw new ScriptError(`${specifier} exports no extractStoryComponent`);
  return module;
};
