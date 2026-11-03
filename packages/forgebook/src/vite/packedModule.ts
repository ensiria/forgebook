/**
 * A module's JSON kept out of a build's JavaScript: gzipped in a file of its own, unpacked when the module loads
 * (`packedText.ts`).
 *
 * @remarks
 * A static catalogue's "Used in" is read by few visits and compresses to a tenth, so a build writes it as a file and
 * the module keeps only its address. A dev server answers with the JSON itself.
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
 * The JSON in a gzipped file named by its content, for a build. The module's value is the promise of it, which its
 * loader (`import(…).then((module) => module.default)`) waits for: no top-level await, which a catalogue's lower
 * `build.target` would refuse.
 *
 * @param emit - writes the file.
 */
export const packedJsonOf =
  (emit: EmitAsset): PackJson =>
  (json: string): string => {
    const name = createHash("sha256").update(json).digest("hex").slice(0, 8);
    const fileName = `assets/${name}.bin`;
    // gzip's default level: a higher one takes twice as long on a large index for the same size
    emit({ type: "asset", fileName, source: gzipSync(json) });
    const address = `import.meta.env.BASE_URL + ${JSON.stringify(fileName)}`;
    return `import(${JSON.stringify(PACKED_TEXT)}).then((module) => module.packedJson(${address}))`;
  };
