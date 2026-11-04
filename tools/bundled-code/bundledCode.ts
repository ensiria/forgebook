/**
 * The code a catalogue's build makes of a frame page's entry, for the tests that check what a frame page reaches (the
 * React family's: no server renderer in a static catalogue).
 *
 * @remarks
 * The build bundles the entry's own files and leaves every package as an import, so a test reads which packages the
 * page imports without bundling them.
 *
 * @module
 */
import { isAbsolute } from "node:path";

import { build } from "vite";

/**
 * Whether an import names a package, which the build leaves as an import, rather than a file of the entry's package.
 *
 * @remarks
 * Rollup asks a second time with the id it resolved, an absolute path in the platform's form: on Windows `D:\…`, which
 * starts with neither `.` nor `/`. A test on the first character alone would leave the package's own files out of the
 * bundle there.
 *
 * @param id - the import as written, or the path it resolved to.
 * @param isAbsolutePath - the platform's test for an absolute path; Node's for this platform by default.
 */
export const isPackageImport = (
  id: string,
  isAbsolutePath: (path: string) => boolean = isAbsolute
): boolean => !id.startsWith(".") && !isAbsolutePath(id);

/**
 * The code a build makes of an entry, every chunk's, with its dependencies left as imports.
 *
 * @param entry - the entry's absolute path.
 */
export const bundledCode = async (entry: string): Promise<string> => {
  const output = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: false,
      lib: { entry, formats: ["es"] },
      rollupOptions: { external: (id: string) => isPackageImport(id) }
    }
  });
  // a list for several formats, a watcher in watch mode: neither here, but the type allows them
  const results = Array.isArray(output) ? output : [output];
  return results
    .flatMap((result) => ("output" in result ? result.output : []))
    .map((chunk) => (chunk.type === "chunk" ? chunk.code : ""))
    .join("\n");
};
