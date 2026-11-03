/**
 * Tests for the design tokens' module a designer's page imports: the files it watches, and what a published page may
 * say of a file it could not read.
 *
 * @module
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { ResolvedConfig } from "../src/vite/configFile.ts";
import { ISOLATED_FRAMES } from "../src/vite/framesConfig.ts";
import { tokensModule } from "../src/vite/storylessRoutes.ts";
import { VITE_PATHS } from "../src/vite/vitePaths.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/**
 * A configuration in a folder, with the tokens files given.
 *
 * @param dir - the configuration's folder.
 * @param tokens - its tokens files, by name in the folder.
 */
const configIn = (dir: string, tokens: readonly string[]): ResolvedConfig => ({
  dir,
  framework: STUB_FRAMEWORK,
  title: "Acme",
  logo: undefined,
  heights: undefined,
  stories: [],
  docs: [],
  sources: [],
  switches: undefined,
  languages: [],
  previews: [],
  head: "",
  shell: { themeCss: "", frameCss: "", hasBranding: true, styleSheets: [], problems: [] },
  tokens: tokens.map((name) => ({ path: VITE_PATHS.join(dir, name), mode: undefined })),
  watch: [],
  lists: {},
  hasPlayTools: false,
  plugins: [],
  frames: ISOLATED_FRAMES,
  build: { readableNames: false }
});

/** No source resolves: the configurations here name none. */
const unresolved = async (): Promise<undefined> => undefined;

describe("tokensModule", () => {
  it("watches the tokens files, and names one it cannot read from the catalogue's folder", async () => {
    const dir = VITE_PATHS.normalize(mkdtempSync(join(tmpdir(), "forgebook-tokens-")));
    writeFileSync(
      join(dir, "tokens.json"),
      '{ "color": { "brand": { "$type": "color", "$value": "#123456" } } }'
    );
    const watched: string[] = [];
    const module = await tokensModule(
      configIn(dir, ["tokens.json", "missing.json"]),
      (file) => watched.push(file),
      unresolved
    );
    expect(watched).toEqual([VITE_PATHS.join(dir, "tokens.json"), VITE_PATHS.join(dir, "missing.json")]);
    expect(module.code).toContain("color.brand");
    expect(module.code).toContain("missing.json");
    expect(module.code).not.toContain(dir);
  });
});
