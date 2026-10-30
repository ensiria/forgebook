/**
 * Tests for a catalogue's configuration read: its presets merged under it, its preview found beside it, its problems
 * named.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { contrastSwitch, themeSwitch } from "../src/switches";
import type { ForgebookConfig } from "../src/vite/config";
import { findConfigFile, resolveConfig } from "../src/vite/configFile";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework";

/** A configuration with the least it needs. */
const BASE: ForgebookConfig = {
  framework: STUB_FRAMEWORK,
  title: "Catalogue",
  sources: ["@acme/ui/stories"]
};

/** A new empty folder for a catalogue. */
const folder = (): string => mkdtempSync(join(tmpdir(), "forgebook-config-"));

describe("resolveConfig", () => {
  it("merges the presets under the configuration: a switch or language of the same id is replaced in its place", () => {
    const dark = { ...themeSwitch(), default: "dark" };
    const resolved = resolveConfig(
      {
        ...BASE,
        switches: [dark],
        languages: [{ id: "it", label: "Italiano (catalogue)" }],
        head: '<link rel="stylesheet" href="/fonts.css" />',
        presets: [
          {
            name: "acme",
            switches: [themeSwitch(), contrastSwitch()],
            languages: [
              { id: "it", label: "Italiano" },
              { id: "de", label: "Deutsch" }
            ],
            preview: "/acme/preview.ts",
            head: '<meta name="acme" />'
          }
        ]
      },
      "/catalogue"
    );
    expect(resolved.switches?.map((each) => [each.id, each.default])).toEqual([
      ["theme", "dark"],
      ["contrast", "standard"]
    ]);
    expect(resolved.languages).toEqual([
      { id: "it", label: "Italiano (catalogue)" },
      { id: "de", label: "Deutsch" }
    ]);
    expect(resolved.previews).toEqual(["/acme/preview.ts"]);
    expect(resolved.head).toBe('<meta name="acme" />\n<link rel="stylesheet" href="/fonts.css" />');
  });

  it("leaves the switches to the default ones when neither the configuration nor a preset declares any", () => {
    expect(resolveConfig(BASE, "/catalogue").switches).toBeUndefined();
  });

  it("makes the logo absolute and finds the preview beside the configuration, after the presets'", () => {
    const dir = folder();
    writeFileSync(join(dir, "forgebook.preview.tsx"), "export default {};");
    const resolved = resolveConfig(
      { ...BASE, logo: "logo.svg", presets: [{ name: "a", preview: "/a.ts" }] },
      dir
    );
    expect(resolved.logo).toBe(join(dir, "logo.svg"));
    expect(resolved.previews).toEqual(["/a.ts", join(dir, "forgebook.preview.tsx")]);
  });

  it("names a problem of the merged switches with the configuration's file", () => {
    expect(() =>
      resolveConfig({ ...BASE, switches: [{ ...themeSwitch(), id: "width" }] }, "/catalogue")
    ).toThrow('/catalogue/forgebook.config: "width" is a parameter of the address, not a switch\'s name');
  });
});

describe("findConfigFile", () => {
  it("finds forgebook.config.ts in a folder, and none in a folder without one", () => {
    const dir = folder();
    expect(findConfigFile(dir)).toBeUndefined();
    mkdirSync(join(dir, "nested"));
    writeFileSync(join(dir, "forgebook.config.ts"), "export default {};");
    expect(findConfigFile(dir)).toBe(join(dir, "forgebook.config.ts"));
  });
});
