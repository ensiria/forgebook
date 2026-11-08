/**
 * A cell's pure parts: the overrides written into the root manifest, the version an install put in place, and the
 * verdict from the commands.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { commandsVerdict, installedVersion, versionMismatches, withOverrides } from "./cell.ts";

describe("withOverrides", () => {
  it("pins the packages through pnpm's overrides and keeps every other field and override", () => {
    const source = JSON.stringify({
      name: "w",
      pnpm: { overrides: { lodash: "4.17.21" }, patchedDependencies: {} }
    });
    expect(JSON.parse(withOverrides(source, { react: "18.3.1", "react-dom": "18.3.1" }))).toEqual({
      name: "w",
      pnpm: {
        overrides: { lodash: "4.17.21", react: "18.3.1", "react-dom": "18.3.1" },
        patchedDependencies: {}
      }
    });
  });

  it("adds the field to a manifest that has none", () => {
    expect(JSON.parse(withOverrides('{"name":"w"}', { vite: "8.3.6" }))).toEqual({
      name: "w",
      pnpm: { overrides: { vite: "8.3.6" } }
    });
  });
});

describe("installedVersion", () => {
  const folders: string[] = [];
  afterEach(() => {
    for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
  });

  it("reads the nearest node_modules above the folder, as Node resolves", () => {
    const root = mkdtempSync(join(tmpdir(), "compat-"));
    folders.push(root);
    mkdirSync(join(root, "node_modules", "@scope", "lib"), { recursive: true });
    writeFileSync(join(root, "node_modules", "@scope", "lib", "package.json"), '{"version":"2.0.0"}');
    mkdirSync(join(root, "packages", "a", "node_modules", "@scope", "lib"), { recursive: true });
    writeFileSync(
      join(root, "packages", "a", "node_modules", "@scope", "lib", "package.json"),
      '{"version":"1.0.0"}'
    );
    mkdirSync(join(root, "packages", "b"), { recursive: true });
    expect(installedVersion("@scope/lib", [join(root, "packages", "a")])).toBe("1.0.0");
    expect(installedVersion("@scope/lib", [join(root, "packages", "b")])).toBe("2.0.0");
    expect(installedVersion("missing", [join(root, "packages", "b")])).toBeUndefined();
  });
});

describe("versionMismatches", () => {
  it("names each package the install left at another version, or left out", () => {
    expect(versionMismatches({ react: "19.3.0" }, { react: "18.3.1", "react-dom": "18.3.1" })).toEqual([
      "react 19.3.0 (asked 18.3.1)",
      "react-dom missing (asked 18.3.1)"
    ]);
    expect(versionMismatches({ vite: "8.3.6" }, { vite: "8.3.6" })).toEqual([]);
  });
});

describe("commandsVerdict", () => {
  it("passes only when every command ended with 0, and names the ones that did not", () => {
    expect(commandsVerdict([{ command: "a", code: 0 }])).toEqual({ status: "passed" });
    expect(
      commandsVerdict([
        { command: "a", code: 1 },
        { command: "b", code: 0 },
        { command: "c", code: null }
      ])
    ).toEqual({ status: "failed", reason: "failed: a; c" });
  });
});
