/**
 * A module's JSON kept out of a build's JavaScript: gzipped in a file of its own, unpacked when the module loads.
 *
 * @remarks
 * A static catalogue's search index and its "Used in" are read by few visits and compress to a tenth, so a build writes
 * them as files, and the module that holds them keeps only the address. A dev server answers with the JSON itself.
 *
 * @module
 */
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

/** Writes a module's JSON as the expression of its value. */
export type PackJson = (json: string) => string;

/** What the plugin writes a file with: Rollup's `emitFile`, narrowed to an asset of a known name. */
type EmitAsset = (asset: {
  readonly type: "asset";
  readonly fileName: string;
  readonly source: Uint8Array;
}) => unknown;

/** The JSON as it is, on a dev server. */
export const inlineJson: PackJson = (json: string): string => json;

/**
 * The JSON in a gzipped file, for a build.
 *
 * @param emit - writes the file.
 */
export const packedJsonOf =
  (emit: EmitAsset): PackJson =>
  (json: string): string => {
    const name = createHash("sha256").update(json).digest("hex").slice(0, 8);
    const fileName = `assets/${name}.bin`;
    emit({ type: "asset", fileName, source: gzipSync(json, { level: 9 }) });
    const address = `import.meta.env.BASE_URL + ${JSON.stringify(fileName)}`;
    return `await (await import("forgebook/packed-text")).packedJson(${address})`;
  };
