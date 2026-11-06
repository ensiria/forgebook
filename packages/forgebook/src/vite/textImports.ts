/**
 * What a file's text says it imports, where no compiler can tell: a style sheet's own imports, and the sheets, templates
 * and single-file components a module names as strings.
 *
 * @remarks
 * Apart from `usageImports.ts`, which needs the compiler: the dev server's thread reads these too, for the sheets every
 * story shows, and it must start without one.
 *
 * @module
 */
import { existsSync } from "node:fs";

import { VITE_PATHS } from "./vitePaths.ts";

/** A relative path to a file TypeScript does not read, standing as a string, with any query Vite takes. */
const ASSET_PATH =
  /["'`](\.{1,2}\/[^"'`\n?]+\.(?:css|scss|sass|less|vue|svelte|astro|html))(?:\?[^"'`\n]*)?["'`]/g;

/** A style sheet's own imports. */
const SHEET_USE = /@(?:use|forward)\s+["']([^"']+)["']/g;

/** A sheet's `@import`, which may list several, or set Less's options first. */
const SHEET_IMPORT = /@import\s+([^;\n]{1,2000})/g;

/** A quoted name in an `@import`. */
const QUOTED = /["']([^"']+)["']/g;

/** Where a style sheet's import may be, from the name it writes: Sass omits the extension and the partial's `_`. */
const sheetCandidates = (path: string): readonly string[] => {
  const folder = VITE_PATHS.dirname(path);
  const name = path.slice(folder.length + 1);
  return [
    path,
    ...["scss", "sass", "css", "less"].flatMap((extension) => [
      `${path}.${extension}`,
      VITE_PATHS.join(folder, `_${name}.${extension}`),
      VITE_PATHS.join(path, `_index.${extension}`),
      VITE_PATHS.join(path, `index.${extension}`)
    ]),
    VITE_PATHS.join(folder, `_${name}`)
  ];
};

/**
 * The files a style sheet's text imports: its own folder's, a package's and an address are not this package's.
 *
 * @param file - the sheet, absolute.
 * @param text - its text.
 * @param exists - whether a file exists.
 */
export const sheetImports = (
  file: string,
  text: string,
  exists: (path: string) => boolean = existsSync
): string[] =>
  [
    ...[...text.matchAll(SHEET_USE)].map((match) => match[1] ?? ""),
    ...[...text.matchAll(SHEET_IMPORT)].flatMap((statement) =>
      [...(statement[1] ?? "").matchAll(QUOTED)].map((match) => match[1] ?? "")
    )
  ].flatMap((name) => {
    if (name.includes(":")) return [];
    const path = VITE_PATHS.join(VITE_PATHS.dirname(file), name);
    return [sheetCandidates(path).find(exists) ?? path];
  });

/**
 * Every relative asset a module's text names as a string.
 *
 * @param file - the module, absolute.
 * @param text - its text.
 */
export const assetImports = (file: string, text: string): string[] =>
  [...text.matchAll(ASSET_PATH)].map((match) => VITE_PATHS.join(VITE_PATHS.dirname(file), match[1] ?? ""));
