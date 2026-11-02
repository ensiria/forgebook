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

import { contrastSwitch, themeSwitch } from "../src/switches.ts";
import type { ForgebookConfig } from "../src/vite/config.ts";
import { findConfigFile, resolveConfig } from "../src/vite/configFile.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

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

describe("the shell's branding", () => {
  it("stays on unless turned off, the catalogue winning over its presets", () => {
    const off = { shell: { branding: false } };
    const on = { shell: { branding: true } };
    const preset = { name: "p", ...off };
    expect(resolveConfig(BASE, "/c").shell.hasBranding).toBe(true);
    expect(resolveConfig({ ...BASE, ...off }, "/c").shell.hasBranding).toBe(false);
    expect(resolveConfig({ ...BASE, presets: [preset] }, "/c").shell.hasBranding).toBe(false);
    expect(resolveConfig({ ...BASE, presets: [preset], ...on }, "/c").shell.hasBranding).toBe(true);
  });
});

describe("the shell's look", () => {
  const base = { framework: STUB_FRAMEWORK, title: "T", stories: ["s"] };

  it("merges a preset's theme under the catalogue's, role by role", () => {
    const { shell } = resolveConfig(
      {
        ...base,
        presets: [{ name: "p", shell: { theme: { fonts: { sans: "Inter" }, dark: { accent: "#111111" } } } }],
        shell: { theme: { dark: { accent: "#b28bff" } } }
      },
      "/c"
    );
    expect(shell.themeCss).toContain("--forgebook-font-sans:Inter");
    expect(shell.themeCss).toContain("--forgebook-accent:#b28bff");
    expect(shell.themeCss).not.toContain("#111111");
  });

  it("lists style sheets with the presets' first, and makes the catalogue's absolute", () => {
    const { shell } = resolveConfig(
      { ...base, presets: [{ name: "p", shell: { css: "/lib/shell.css" } }], shell: { css: "own.css" } },
      "/c"
    );
    expect(shell.styleSheets).toEqual(["/lib/shell.css", "/c/own.css"]);
  });

  it("refuses a value that would break the page, naming it", () => {
    expect(() => resolveConfig({ ...base, shell: { theme: { dark: { text: "red}" } } } }, "/c")).toThrow(
      "dark.text"
    );
  });

  it("keeps what will not work, for a warning", () => {
    const { shell } = resolveConfig({ ...base, shell: { theme: { light: { text: "#eeeeee" } } } }, "/c");
    expect(shell.problems.length).toBeGreaterThan(0);
  });
});
