/**
 * Tests the line `bundledCode` draws between packages and the entry's own files, on Windows paths as on POSIX ones.
 *
 * @module
 */
import { posix, win32 } from "node:path";

import { describe, expect, it } from "vitest";

import { isPackageImport } from "./bundledCode.ts";

describe("isPackageImport", () => {
  it("keeps a file the build resolved to a Windows path in the bundle", () => {
    const resolved = "D:\\a\\forgebook\\packages\\react\\src\\reactFrameRenderer.tsx";
    expect(isPackageImport(resolved, win32.isAbsolute)).toBe(false);
  });

  it("keeps a file the build resolved to a POSIX path in the bundle", () => {
    const resolved = "/a/forgebook/packages/react/src/reactFrameRenderer.tsx";
    expect(isPackageImport(resolved, posix.isAbsolute)).toBe(false);
  });

  it("keeps a relative import in the bundle", () => {
    expect(isPackageImport("./reactFrameRenderer.tsx", win32.isAbsolute)).toBe(false);
  });

  it("leaves a package as an import, with or without a subpath or scope", () => {
    expect(isPackageImport("react-dom/client", win32.isAbsolute)).toBe(true);
    expect(isPackageImport("@forgebook/react/frame-renderer", posix.isAbsolute)).toBe(true);
  });
});
