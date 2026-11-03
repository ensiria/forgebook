/**
 * Tests for what `forgebook docs` reads besides the exports: the package's catalogue options, what its source declares, and
 * the `llms.txt` it writes.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import {
  CATALOGUE_SECTIONS,
  catalogueOptionsOf,
  DEFAULT_CATALOGUE_OPTIONS,
  isExcluded
} from "../bin/forgebook-docs/catalogueOptions.ts";
import { llmsText } from "../bin/forgebook-docs/llmsText.ts";
import { declaredSource } from "../src/vite/sourceTokens.ts";

describe("catalogueOptionsOf", () => {
  it("takes the defaults when the package sets none", () => {
    expect(catalogueOptionsOf({ name: "@acme/ui" })).toEqual({
      options: DEFAULT_CATALOGUE_OPTIONS,
      problems: []
    });
  });

  it("reads the file's name, the sections and the exclusions", () => {
    const manifest = {
      forgebook: { catalog: { file: "AGENTS-CATALOG.md", sections: ["modules"], exclude: ["./internal/*"] } }
    };
    expect(catalogueOptionsOf(manifest)).toEqual({
      options: { file: "AGENTS-CATALOG.md", sections: ["modules"], exclude: ["./internal/*"] },
      problems: []
    });
  });

  it("names each mistake and keeps the defaults for it", () => {
    const { options, problems } = catalogueOptionsOf({
      forgebook: { catalog: { file: "docs/CATALOG.md", sections: ["widgets"], exclude: "./x" } }
    });
    expect(options).toEqual(DEFAULT_CATALOGUE_OPTIONS);
    expect(problems).toHaveLength(3);
    expect(problems[1]).toContain(CATALOGUE_SECTIONS.join(", "));
  });
});

describe("isExcluded", () => {
  it("matches a subpath exactly, or every subpath a pattern ending in * starts", () => {
    expect(isExcluded("./internal/tokens", ["./internal/*"])).toBe(true);
    expect(isExcluded("./select", ["./select"])).toBe(true);
    expect(isExcluded("./select-group", ["./select"])).toBe(false);
  });
});

describe("declaredSource", () => {
  it("reads the id of the exported source, its TypeScript wrappers aside", () => {
    const text =
      'import type { StorySource } from "x";\nexport const source = { id: "kit", name: "Kit" } satisfies StorySource;\n';
    expect(declaredSource("stories.ts", text).id).toBe("kit");
  });

  it("gives none when the id is written by code", () => {
    const text = 'const id = "kit";\nexport const source = { id, name: "Kit" };\n';
    expect(declaredSource("stories.ts", text)).toEqual({ id: undefined, tokens: [], problems: [] });
  });

  it("reads the tokens files, a theme with its mode", () => {
    const text =
      'export const source = { id: "kit", tokens: ["a.json", { file: "dark.json", mode: "dark" }] as const };\n';
    expect(declaredSource("stories.ts", text)).toEqual({
      id: "kit",
      tokens: [
        { file: "a.json", mode: undefined },
        { file: "dark.json", mode: "dark" }
      ],
      problems: []
    });
  });

  it("names tokens it cannot read without running the module, keeping the entries it can", () => {
    const text = 'const b = "b.json";\nexport const source = { tokens: ["a.json", b] };\n';
    const { tokens, problems } = declaredSource("stories.ts", text);
    expect(tokens).toEqual([{ file: "a.json", mode: undefined }]);
    expect(problems).toHaveLength(1);
    expect(
      declaredSource("stories.ts", "const tokens = [];\nexport const source = { tokens };\n").problems
    ).toHaveLength(1);
  });

  it("says so when a source built by code holds a tokens key, and only then", () => {
    const named = declaredSource("stories.ts", 'export const source = make({ tokens: ["a.json"] });\n');
    expect(named.problems).toHaveLength(1);
    const short = declaredSource(
      "stories.ts",
      "const tokens = [];\nexport const source = make({ tokens });\n"
    );
    expect(short.problems).toHaveLength(1);
    const local = declaredSource(
      "stories.ts",
      'const source = { tokens: ["a.json"] };\nexport { source };\n'
    );
    expect(local.problems).toHaveLength(1);
    const written =
      '// tokens: none\nimport tokens from "./tokens.css?url";\nexport const source = make(tokens);\n';
    expect(declaredSource("stories.ts", written).problems).toEqual([]);
  });

  it("leaves unknown what a module that does not parse declares", () => {
    const { problems, unread } = declaredSource("stories.ts", "export const = ;\n");
    expect(problems).toEqual([]);
    expect(unread).toContain("cannot be parsed");
  });
});

describe("llmsText", () => {
  it("points to the tokens only when the catalogue lists some", () => {
    const input = { packageName: "@acme/ui", description: undefined, catalogueFile: "CATALOG.md" };
    expect(llmsText(input)).not.toContain("tokens");
    expect(llmsText({ ...input, hasTokens: true })).toContain("npx forgebook tokens --nearest");
  });

  it("names the package, its description and the catalogue, and where the agent commands work", () => {
    const text = llmsText({
      packageName: "@acme/ui",
      description: "Acme's components.",
      catalogueFile: "CATALOG.md"
    });
    expect(text.startsWith("# @acme/ui\n\n> Acme's components.\n")).toBe(true);
    expect(text).toContain("- [CATALOG.md](CATALOG.md): ");
    expect(text).toContain("Where the package's own catalogue runs");
  });
});
