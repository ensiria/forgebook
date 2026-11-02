/**
 * Tests for a shell's theme from design tokens: what each appearance takes, and what cannot be used.
 *
 * @module
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveConfig } from "../src/vite/configFile.ts";
import type { DesignToken } from "../src/vite/designTokens.ts";
import { tokenTheme, tokenThemeOf } from "../src/vite/themeFromTokens.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

const color = (name: string, value: string, extra: Partial<DesignToken> = {}): DesignToken => ({
  name,
  type: "color",
  value,
  modes: {},
  ...extra
});

describe("tokenTheme", () => {
  it("takes a token's themes for each appearance, and its value where it has none", () => {
    const tokens = [color("brand", "#111111", { modes: { dark: "#eeeeee" } }), color("ink", "#222222")];
    expect(tokenTheme({ accent: "brand", text: "ink" }, tokens)).toEqual({
      theme: {
        light: { accent: "#111111", text: "#222222" },
        dark: { accent: "#eeeeee", text: "#222222" }
      },
      problems: []
    });
  });

  it("leaves an appearance alone when only another theme defines the token", () => {
    const tokens = [color("glow", "#333333", { isThemeOnly: true, modes: { dark: "#333333" } })];
    expect(tokenTheme({ accent: "glow" }, tokens).theme).toEqual({ light: {}, dark: { accent: "#333333" } });
  });

  it("reports a name that is no token and a token that is no colour, keeping the shell's own", () => {
    const tokens = [{ ...color("space", "4px"), type: "dimension" }];
    const { theme, problems } = tokenTheme({ accent: "missing", text: "space" }, tokens);
    expect(theme).toEqual({ light: {}, dark: {} });
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('"missing"');
    expect(problems[1]).toContain("dimension");
  });
});

describe("tokenThemeOf", () => {
  it("reads nothing with no mapping, even with a file that is not there", () => {
    expect(tokenThemeOf({}, [{ path: "/nowhere.json", mode: undefined }], "/")).toEqual({
      theme: {},
      problems: []
    });
  });

  it("says when a mapping has no tokens file, or the file cannot be read", () => {
    expect(tokenThemeOf({ accent: "a" }, [], "/").problems[0]).toContain("no tokens file");
    const missing = tokenThemeOf({ accent: "a" }, [{ path: "/nowhere.json", mode: undefined }], "/");
    expect(missing.problems[0]).toContain("/nowhere.json");
  });
});

describe("a catalogue's configuration", () => {
  const withTokens = (): string => {
    const dir = mkdtempSync(join(tmpdir(), "forgebook-theme-"));
    const file = {
      brand: Object.fromEntries([
        ["$type", "color"],
        ["$value", "#123456"]
      ])
    };
    writeFileSync(join(dir, "tokens.json"), JSON.stringify(file));
    return dir;
  };

  it("themes the shell from tokens in a few lines, and what is written by hand wins", () => {
    const dir = withTokens();
    const base = { framework: STUB_FRAMEWORK, title: "T", tokens: ["tokens.json"] };
    const themed = resolveConfig({ ...base, shell: { theme: { fromTokens: { accent: "brand" } } } }, dir);
    expect(themed.shell.themeCss).toContain("--forgebook-accent:#123456");
    const fixed = resolveConfig(
      { ...base, shell: { theme: { fromTokens: { accent: "brand" }, light: { accent: "#654321" } } } },
      dir
    );
    expect(fixed.shell.themeCss).toContain("--forgebook-accent:#654321");
  });

  it("costs a catalogue with no mapping nothing", () => {
    const config = { framework: STUB_FRAMEWORK, title: "T", tokens: ["tokens.json"] };
    expect(resolveConfig(config, withTokens()).shell.themeCss).toBe("");
  });
});
