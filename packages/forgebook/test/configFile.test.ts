/**
 * Tests for a catalogue's configuration read: its presets merged under it, its preview found beside it, its problems
 * named.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, win32 } from "node:path";

import { describe, expect, it } from "vitest";

import { contrastSwitch, themeSwitch } from "../src/switches.ts";
import type { ForgebookConfig } from "../src/vite/config.ts";
import { findConfigFile, resolveConfig } from "../src/vite/configFile.ts";
import { VITE_PATHS, vitePathsOf } from "../src/vite/vitePaths.ts";
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
  it("refuses an audience that is none, from the catalogue or a preset", () => {
    expect(() => resolveConfig({ ...BASE, ...JSON.parse('{"audience":"manager"}') }, "/catalogue")).toThrow(
      'the audience "manager" is none of everyone, designer, coder, tester'
    );
    expect(resolveConfig({ ...BASE, audience: "tester" }, "/catalogue").lists.audience).toBe("tester");
  });

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
    expect(resolved.logo).toBe(VITE_PATHS.join(dir, "logo.svg"));
    expect(resolved.previews).toEqual(["/a.ts", VITE_PATHS.join(dir, "forgebook.preview.tsx")]);
  });

  it("names a problem of the merged switches with the configuration's file", () => {
    expect(() =>
      resolveConfig({ ...BASE, switches: [{ ...themeSwitch(), id: "width" }] }, "/catalogue")
    ).toThrow(
      `${resolve("/catalogue", "forgebook.config")}: "width" is a parameter of the address, not a switch's name`
    );
  });
});

describe("the build's options", () => {
  it("name a build's scripts by their hash alone unless the configuration asks for readable names", () => {
    const base = { title: "A", framework: STUB_FRAMEWORK, stories: ["*.stories.tsx"] };
    expect(resolveConfig(base, "/app").build).toEqual({ readableNames: false });
    expect(resolveConfig({ ...base, build: { readableNames: true } }, "/app").build).toEqual({
      readableNames: true
    });
  });

  it("refuses a device that names a model no one has, and lays the catalogue's fields over a preset's", () => {
    expect(() => resolveConfig({ ...BASE, device: { model: "nokia-3310" } }, "/catalogue")).toThrow(
      `${resolve("/catalogue", "forgebook.config")}: Forgebook's device: "nokia-3310" is no device model`
    );
    // a configuration is code: its types are not a promise
    const loose: ForgebookConfig = { ...BASE };
    Reflect.set(loose, "device", "pixel-9");
    expect(() => resolveConfig(loose, "/catalogue")).toThrow(/Forgebook's device: write it as an object/);
    const resolved = resolveConfig(
      { ...BASE, device: { frame: true }, presets: [{ name: "a", device: { model: "pixel-9" } }] },
      "/catalogue"
    );
    expect(resolved.lists.device).toEqual({ model: "pixel-9", frame: true });
  });
});

describe("the written home", () => {
  it("takes forgebook.home.md beside the configuration, a home it names, or none", () => {
    const dir = folder();
    expect(resolveConfig(BASE, dir).home).toBeUndefined();
    writeFileSync(join(dir, "forgebook.home.md"), "# Home\n");
    expect(resolveConfig(BASE, dir).home).toBe(join(dir, "forgebook.home.md"));
    mkdirSync(join(dir, "docs"));
    writeFileSync(join(dir, "docs/home.md"), "# Other\n");
    expect(resolveConfig({ ...BASE, home: "docs/home.md" }, dir).home).toBe(join(dir, "docs/home.md"));
  });

  it("keeps the generated home with false, even beside a written one", () => {
    const dir = folder();
    writeFileSync(join(dir, "forgebook.home.md"), "# Home\n");
    expect(resolveConfig({ ...BASE, home: false }, dir).home).toBeUndefined();
  });

  it("refuses an empty home, which names no file", () => {
    expect(() => resolveConfig({ ...BASE, home: "" }, folder())).toThrow(/is not a file there/);
  });

  it("names a home that is not there", () => {
    expect(() => resolveConfig({ ...BASE, home: "gone.md" }, folder())).toThrow(
      /its home "gone.md" is not a file there/
    );
  });

  it("ignores a home.md without the prefix, which a project may keep for another reason", () => {
    const dir = folder();
    writeFileSync(join(dir, "home.md"), "# Not the catalogue's\n");
    expect(resolveConfig(BASE, dir).home).toBeUndefined();
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
    expect(shell.styleSheets).toEqual(["/lib/shell.css", VITE_PATHS.resolve("/c", "own.css")]);
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

describe("resolveConfig on Windows", () => {
  it("writes every path in Vite's form, forward slashes, and keeps a preset's package specifier as written", () => {
    const resolved = resolveConfig(
      {
        ...BASE,
        logo: "assets\\logo.svg",
        preview: "..\\shared\\preview.tsx",
        tokens: ["tokens.json", { file: "C:\\Users\\ada\\tokens\\dark.json", mode: "dark" }],
        watch: ["../kit/src"],
        shell: { css: "shell.css" },
        presets: [
          {
            name: "files",
            preview: "C:\\Users\\ada\\kit\\preview.ts",
            shell: { css: "C:\\Users\\ada\\kit\\shell.css" }
          },
          { name: "package", preview: "@acme/ui/preview" }
        ]
      },
      "C:\\Users\\ada\\app",
      vitePathsOf(win32)
    );
    expect(resolved.dir).toBe("C:/Users/ada/app");
    expect(resolved.logo).toBe("C:/Users/ada/app/assets/logo.svg");
    expect(resolved.previews).toEqual([
      "C:/Users/ada/kit/preview.ts",
      "@acme/ui/preview",
      "C:/Users/ada/shared/preview.tsx"
    ]);
    expect(resolved.shell.styleSheets).toEqual(["C:/Users/ada/kit/shell.css", "C:/Users/ada/app/shell.css"]);
    expect(resolved.tokens).toEqual([
      { path: "C:/Users/ada/app/tokens.json", mode: undefined },
      { path: "C:/Users/ada/tokens/dark.json", mode: "dark" }
    ]);
    expect(resolved.watch).toEqual(["C:/Users/ada/kit/src"]);
  });
});
