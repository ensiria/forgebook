/**
 * Tests for what `forgebook docs` reads besides the exports: the package's catalogue options, its source's id, and the
 * `llms.txt` it writes.
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
import { sourceIdOf } from "../bin/forgebook-docs/sourceId.ts";

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

describe("sourceIdOf", () => {
  it("reads the id of the exported source, its TypeScript wrappers aside", () => {
    const text =
      'import type { StorySource } from "x";\nexport const source = { id: "kit", name: "Kit" } satisfies StorySource;\n';
    expect(sourceIdOf("stories.ts", text)).toBe("kit");
  });

  it("gives none when the id is written by code", () => {
    expect(
      sourceIdOf("stories.ts", 'const id = "kit";\nexport const source = { id, name: "Kit" };\n')
    ).toBeUndefined();
  });
});

describe("llmsText", () => {
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
