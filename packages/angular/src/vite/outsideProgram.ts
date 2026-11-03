/**
 * The Vite plugin that strips the types of the TypeScript files Angular's compiler does not compile: those outside the
 * program of the catalogue's TypeScript configuration, such as `forgebook.preview.ts`, a sources file, or a story file
 * the configuration does not include.
 *
 * @remarks
 * Analog's plugin turns Vite's own TypeScript and JSX transform off, since it would lower a component's decorators before
 * Angular's compiler reads them, and compiles the files of its program instead. A file outside that program would reach
 * the page with its types. This plugin reads which files the program holds from the configuration (its file list only,
 * no type check) and strips the types of any other, after Analog's plugin, so a component Angular compiles is never
 * touched. The list is read again at each start and when a configuration changes.
 *
 * @module
 */
import { resolve } from "node:path";

import ts from "typescript-6";
import type { Plugin } from "vite";

/** A TypeScript module's path, with its query left out: with JSX or without. */
const TYPESCRIPT_FILE = /\.([cm]?ts|tsx)$/;

/**
 * Whether a module is one the catalogue makes of a file (`Badge.stories.ts?forgebook-code`), not the file itself.
 *
 * @param id - the module's id.
 */
export const isCatalogueModule = (id: string): boolean => /[?&]forgebook-/.test(id);

/**
 * The files a TypeScript configuration's program holds, as absolute paths with forward slashes.
 *
 * @param configFile - the configuration, absolute.
 */
export const programFiles = (configFile: string): ReadonlySet<string> => {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configFile,
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined }
  );
  return new Set((parsed?.fileNames ?? []).map((file) => resolve(file).split("\\").join("/")));
};

/**
 * The plugin.
 *
 * @param configFile - the TypeScript configuration Angular's compiler reads, absolute, read when the server starts.
 * @returns the plugin.
 */
export const outsideProgram = (configFile: () => string): Plugin => {
  let compiled: ReadonlySet<string> = new Set();
  return {
    name: "forgebook:angular-outside-program",
    enforce: "post",
    buildStart: (): void => {
      compiled = programFiles(configFile());
    },
    watchChange: (id: string): void => {
      if (/tsconfig[^/\\]*\.json$/.test(id)) compiled = programFiles(configFile());
    },
    transform: async (code: string, id: string) => {
      const [file = ""] = id.split("?");
      if (
        !TYPESCRIPT_FILE.test(file) ||
        file.endsWith(".d.ts") ||
        compiled.has(file) ||
        isCatalogueModule(id)
      )
        return undefined;
      const { transformWithOxc } = await import("vite");
      // JSX as React's automatic runtime writes it: the catalogue's own page is React
      const stripped = file.endsWith(".tsx")
        ? await transformWithOxc(code, file, { lang: "tsx", jsx: { runtime: "automatic" } })
        : await transformWithOxc(code, file, { lang: "ts" });
      return stripped.map === undefined
        ? { code: stripped.code }
        : { code: stripped.code, map: stripped.map };
    }
  };
};
