/**
 * Tests for where a frame finds axe's script: a `?url` import on a dev server, a gzipped file named by its text in a
 * build.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { codeLiteral } from "../src/codeLiteral.ts";
import { axeAddress, axeBuildAsset } from "../src/vite/axeScript.ts";
import { packageResolver } from "../src/vite/configFile.ts";

/** The core's folder, where axe is one of its dependencies. */
const PACKAGE_DIR: string = import.meta.dirname;

describe("axeAddress", () => {
  it("imports the script's address on a dev server", () => {
    const address = axeAddress("serve", PACKAGE_DIR);
    expect(address?.imports[0]).toMatch(/^import axeUrl from ".*axe\.min\.js\?url";$/);
    expect(address?.value).toBe("axeUrl");
  });

  it("names a build's gzipped copy under the base, the same as the file the build writes", () => {
    const address = axeAddress("build", PACKAGE_DIR);
    const asset = axeBuildAsset(PACKAGE_DIR);
    expect(address?.imports).toEqual([]);
    expect(asset?.fileName).toMatch(/^assets\/axe-[0-9a-f]{8}\.bin$/);
    expect(address?.value).toBe(`import.meta.env.BASE_URL + ${codeLiteral(asset?.fileName)}`);
  });

  it("writes the script gzipped, whole", () => {
    const file = packageResolver(PACKAGE_DIR)("axe-core/axe.min.js");
    const asset = axeBuildAsset(PACKAGE_DIR);
    if (file === undefined || asset === undefined) throw new Error("axe is not installed");
    expect(gunzipSync(asset.source).equals(readFileSync(file))).toBe(true);
    expect(asset.source.length).toBeLessThan(readFileSync(file).length / 3);
  });
});
