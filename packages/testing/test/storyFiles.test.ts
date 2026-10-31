/**
 * Tests for a package's story files read from the disk: their keys are the catalogue plugin's, also for a pattern that
 * climbs out of the declaring module's folder, so `storyFilesMismatch` compares like with like.
 *
 * @module
 */
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

  it("keys a pattern that climbs out of the declaring folder as the plugin does, its ../ moved into the folder", () => {
    const options = {
      sourceId: "kit",
      name: "Kit",
      root: join(KIT, "locales"),
      patterns: ["../src/*.stories.tsx"]
    };
    expect(storyFiles(options)).toContain("./src/Select.stories.tsx");
    const [files] = indexedSource(options).files;
    expect(Object.keys(files?.index ?? {})).toContain("./src/Select.stories.tsx");
    expect(files?.index["./src/Select.stories.tsx"]?.title).toBe("Inputs/Selection/Select");
  });
});
