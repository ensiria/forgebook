/**
 * Tests that React's frame page leaves the server renderer out: bundled as a catalogue's build bundles it, its code
 * reaches no import of `react-dom/server`, so no static catalogue ships it and no first start pre-bundles it.
 *
 * @module
 */
import { isAbsolute, join, posix, win32 } from "node:path";

import { build } from "vite";
import { describe, expect, it } from "vitest";

/** The frame page's entry, as the plugin's generated page imports it (`@forgebook/react/frame`). */
const FRAME_ENTRY = join(import.meta.dirname, "..", "src", "mountFrame.ts");

/**
 * Whether an import names a package, which the build leaves as an import, rather than a file of this one.
 *
 * @remarks
 * Rollup asks again with the id it resolved, an absolute path in the platform's form: on Windows `D:\…`, which
 * starts with neither `.` nor `/`, so a test on the first character alone leaves the package's own files out.
 *
 * @param id - the import as written, or the path it resolved to.
 * @param isAbsolutePath - the platform's test for an absolute path.
 */
const isPackageImport = (id: string, isAbsolutePath: (path: string) => boolean): boolean =>
  !id.startsWith(".") && !isAbsolutePath(id);

/**
 * The code a build makes of an entry, every chunk's, with its dependencies left as imports.
 *
 * @param entry - the entry's path.
 */
const bundledCode = async (entry: string): Promise<string> => {
  const output = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: false,
      lib: { entry, formats: ["es"] },
      rollupOptions: { external: (id: string) => isPackageImport(id, isAbsolute) }
    }
  });
  // a list for several formats, a watcher in watch mode: neither here, but the type allows them
  const results = Array.isArray(output) ? output : [output];
  return results
    .flatMap((result) => ("output" in result ? result.output : []))
    .map((chunk) => (chunk.type === "chunk" ? chunk.code : ""))
    .join("\n");
};

describe("the build's line between packages and files", () => {
  it("keeps a resolved file in the bundle on Windows as on POSIX, and leaves packages out", () => {
    expect(
      isPackageImport("D:\\a\\forgebook\\packages\\react\\src\\reactFrameRenderer.tsx", win32.isAbsolute)
    ).toBe(false);
    expect(isPackageImport("/a/forgebook/packages/react/src/reactFrameRenderer.tsx", posix.isAbsolute)).toBe(
      false
    );
    expect(isPackageImport("./reactFrameRenderer.tsx", win32.isAbsolute)).toBe(false);
    expect(isPackageImport("react-dom/client", win32.isAbsolute)).toBe(true);
    expect(isPackageImport("forgebook/frame", posix.isAbsolute)).toBe(true);
  });
});

describe("the frame page", () => {
  it("reaches React's client renderer and not its server renderer", async () => {
    const code = await bundledCode(FRAME_ENTRY);
    expect(code).toContain("react-dom/client");
    expect(code).not.toContain("react-dom/server");
  });
});
