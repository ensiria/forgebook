/**
 * Tests for a package's story files read from the disk: their keys are the catalogue plugin's (relative to the declaring
 * module, also for a pattern that climbs out of its folder), so `storyFilesMismatch` compares like with like, and two
 * patterns of one source never share a key.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { indexedSource, storyFiles } from "../src/storyFiles.ts";

/** The fixture kit, whose story files are in `src`. */
const KIT = join(import.meta.dirname, "..", "..", "..", "fixtures", "kit");

describe("storyFiles", () => {
  it("keys a pattern in the declaring folder as the plugin does", () => {
    expect(
      storyFiles({ sourceId: "kit", name: "Kit", root: KIT, patterns: ["./src/*.stories.tsx"] })
    ).toContain("./src/Select.stories.tsx");
  });

  it("keys a pattern that climbs out of the declaring folder as the plugin does, relative to that folder", () => {
    const options = {
      sourceId: "kit",
      name: "Kit",
      root: join(KIT, "locales"),
      patterns: ["../src/*.stories.tsx"]
    };
    expect(storyFiles(options)).toContain("../src/Select.stories.tsx");
    const [files] = indexedSource(options).files;
    expect(files?.index["../src/Select.stories.tsx"]?.title).toBe("Inputs/Selection/Select");
  });

  it("keys two files of the same name apart, one pattern climbing out of the declaring folder", () => {
    // `cat/src/A.stories.tsx` and `src/A.stories.tsx`, from `cat`: two files, two keys
    const project = mkdtempSync(join(tmpdir(), "forgebook-keys-"));
    for (const folder of [join(project, "cat", "src"), join(project, "src")]) {
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, "A.stories.tsx"), "export default {};\n");
    }
    const keys = storyFiles({
      sourceId: "kit",
      name: "Kit",
      root: join(project, "cat"),
      patterns: ["./src/*.stories.tsx", "../src/*.stories.tsx"]
    });
    rmSync(project, { recursive: true, force: true });
    expect(keys).toEqual(["../src/A.stories.tsx", "./src/A.stories.tsx"]);
  });
});
