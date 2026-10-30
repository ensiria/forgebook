/**
 * What a package's build for npm writes and publishes, worked out from its sources: where each source lands in
 * `dist/`, the published `exports` and `bin` (pnpm's `publishConfig`), and the compiled style sheets' imports. Pure.
 *
 * @remarks
 * In the workspace a package's `exports` and `bin` name its TypeScript sources, which Node runs with their types
 * stripped. Node strips none inside `node_modules`, so the published package names the JavaScript `tsc` emits in
 * `dist/` (`.ts` and `.tsx` to `.js`, `.mts` to `.mjs`), with its declarations beside it. A style sheet is published
 * compiled (`.scss` to `.css`), so an app needs no Sass for Forgebook's own styles; any other file (a hand-written
 * declaration, a font, a style sheet) is copied as it is. The workspace `exports` stay the one list: the published ones
 * are made from it, and `--check` fails when they differ.
 *
 * @module
 */

import type { PublishConfig, PublishedTarget } from "./packageBuild.types.ts";

/** The folder the build writes, beside the package's `package.json`. */
export const DIST = "dist";

/** A path as `package.json` writes it, relative and starting with `./`. */
const relativePath = (path: string): string => (path.startsWith("./") ? path : `./${path}`);

/** A source's path without its `./`. */
const bare = (path: string): string => path.replace(/^\.\//, "");

/**
 * Where a source lands in `dist/`: TypeScript as the JavaScript `tsc` emits, a style sheet compiled, any other file
 * as it is.
 *
 * @param source - the source's path, relative to the package (`./src/shell/mountShell.tsx`).
 */
export const distPath = (source: string): string => {
  const path = `./${DIST}/${bare(source)}`;
  if (path.endsWith(".d.ts")) return path;
  if (path.endsWith(".mts")) return path.replace(/\.mts$/, ".mjs");
  if (/\.tsx?$/.test(path)) return path.replace(/\.tsx?$/, ".js");
  if (path.endsWith(".scss")) return path.replace(/\.scss$/, ".css");
  return path;
};

/**
 * The declarations `tsc` emits for a source, or none for a file that is not TypeScript (a hand-written declaration
 * is its own).
 *
 * @param source - the source's path, relative to the package.
 */
export const declarationPath = (source: string): string | undefined => {
  if (source.endsWith(".d.ts")) return undefined;
  const path = `./${DIST}/${bare(source)}`;
  if (path.endsWith(".mts")) return path.replace(/\.mts$/, ".d.mts");
  if (/\.tsx?$/.test(path)) return path.replace(/\.tsx?$/, ".d.ts");
  return undefined;
};

/**
 * One published export: TypeScript as its declarations and its JavaScript, a hand-written declaration as types only,
 * any other file as its path in `dist/`.
 *
 * @param source - the workspace export's target.
 */
export const publishedTarget = (source: string): PublishedTarget => {
  if (source.endsWith(".d.ts")) return { types: distPath(source) };
  const types = declarationPath(source);
  return types === undefined ? distPath(source) : { types, default: distPath(source) };
};

/**
 * The published manifest's fields, made from the workspace's `exports` and `bin`.
 *
 * @param exports - the workspace's `exports`, subpath to source.
 * @param bin - the workspace's `bin`, command to source; none for a package without commands.
 */
export const publishConfigOf = (
  exports: Readonly<Record<string, string>>,
  bin: Readonly<Record<string, string>> | undefined
): PublishConfig => ({
  access: "public",
  exports: Object.fromEntries(
    Object.entries(exports).map(([subpath, source]) => [subpath, publishedTarget(relativePath(source))])
  ),
  ...(bin === undefined
    ? {}
    : {
        bin: Object.fromEntries(
          Object.entries(bin).map(([command, source]) => [command, distPath(relativePath(source))])
        )
      })
});

/**
 * Emitted JavaScript with its style sheet imports pointing at the compiled sheets (`./shell.scss` to `./shell.css`).
 *
 * @param code - a module `tsc` emitted.
 */
export const withCompiledStyles = (code: string): string =>
  code.replace(/(["'])(\.{1,2}\/[^"'\n]+)\.scss\1/g, "$1$2.css$1");

/**
 * Whether a source file is compiled, not copied: TypeScript (except a hand-written declaration) and Sass.
 *
 * @param file - the file's path.
 */
export const isCompiled = (file: string): boolean =>
  !file.endsWith(".d.ts") && (/\.(m?ts|tsx)$/.test(file) || file.endsWith(".scss"));

/**
 * Whether a source file belongs to the build: not a test, a test's fixture, a folder's `tsconfig.json` (it checks the
 * sources, the build does not ship them) or a Sass partial (`_tokens.scss`, compiled into the sheets that import it).
 *
 * @param file - the file's path, relative to the package.
 */
export const isPublished = (file: string): boolean =>
  !/\.test\.tsx?$/.test(file) &&
  !file.split("/").some((segment) => segment === "test" || segment === "__fixtures__") &&
  !/(^|\/)tsconfig[^/]*\.json$/.test(file) &&
  !/(^|\/)_[^/]+\.scss$/.test(file);
