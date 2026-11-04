/**
 * A module's JSON kept out of a build's JavaScript: gzipped in a file of its own, unpacked when the module loads
 * (`packedText.ts`).
 *
 * @remarks
 * A static catalogue's "Used in" is read by few visits and compresses to a tenth, so a build writes it as a file and
 * the module keeps only its address; a story file's docs, code and page are written the same way (`builtTexts.ts`). A
 * dev server answers with the JSON itself.
 *
 * @module
 */
import { createHash } from "node:crypto";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { VITE_PATHS } from "./vitePaths.ts";

/**
 * The module the page unpacks with, by its own path: the generated code imports it as a file of this package, so it is
 * no public subpath and a project need not resolve the package by name.
 */
const PACKED_TEXT = VITE_PATHS.normalize(
  fileURLToPath(new URL(`../packedText${extname(import.meta.url)}`, import.meta.url))
);

/** Writes a module's JSON as the expression of its value, or of a promise of it. */
export type PackJson = (json: string) => string;

/** What the plugin writes a file with: Rolldown's `emitFile`, narrowed to an asset of a known name. */
export type EmitAsset = (asset: {
  readonly type: "asset";
  readonly fileName: string;
  readonly source: Uint8Array;
}) => unknown;

/** The JSON as it is, on a dev server. */
export const inlineJson: PackJson = (json: string): string => json;

/**
 * The name a build gives a JSON document's gzipped file: its content's hash, so a host may keep it for ever. Twelve
 * hex digits: a build writes up to three per story file, and two documents of one name would show one in place of the
 * other with no error.
 *
 * @param json - the document.
 */
export const packedFileName = (json: string): string =>
  `assets/${createHash("sha256").update(json).digest("hex").slice(0, 12)}.bin`;

/**
 * A JSON document gzipped, as a build writes it.
 *
 * @param json - the document.
 */
export const gzippedJson = (json: string): Uint8Array =>
  // gzip's default level: a higher one takes twice as long on a large index for the same size
  gzipSync(json);

/**
 * The code of a function that makes the loader of a packed file by its name (`packedFileName`): the module the page
 * unpacks with loads on the first such load, never with the code that holds the loaders. A loader keeps its answer,
 * as an imported module's default is kept, and forgets a failure, so the next load asks again.
 *
 * @param name - the function's name in the generated code.
 */
export const packedLoaderMaker = (name: string): string =>
  [
    `const ${name} = (file) => {`,
    "  let loading;",
    "  return () => {",
    `    loading ??= import(${JSON.stringify(PACKED_TEXT)})`,
    "      .then((module) => module.packedJson(import.meta.env.BASE_URL + file))",
    "      .catch((error) => {",
    "        loading = undefined;",
    "        throw error;",
    "      });",
    "    return loading;",
    "  };",
    "};"
  ].join("\n");

/**
 * The JSON in a gzipped file named by its content, for a build. The module's value is the promise of it, which its
 * loader (`import(…).then((module) => module.default)`) waits for: no top-level await, which a catalogue's lower
 * `build.target` would refuse.
 *
 * @param emit - writes the file.
 */
export const packedJsonOf =
  (emit: EmitAsset): PackJson =>
  (json: string): string => {
    const fileName = packedFileName(json);
    emit({ type: "asset", fileName, source: gzippedJson(json) });
    const address = `import.meta.env.BASE_URL + ${JSON.stringify(fileName)}`;
    return `import(${JSON.stringify(PACKED_TEXT)}).then((module) => module.packedJson(${address}))`;
  };
