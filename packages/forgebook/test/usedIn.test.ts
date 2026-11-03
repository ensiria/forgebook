/**
 * Tests for the "Used in" index as a module writes it: packed once per title and list, read back the same.
 *
 * @module
 */
import type { StorySource } from "@forgebook/story-format/source";
import { describe, expect, it } from "vitest";

import { packedUsage, sourceUsage, unpackedUsage } from "../src/usedIn.ts";

/**
 * A source of one group whose usage module answers a value.
 *
 * @param answer - what the module exports by default.
 */
const sourceAnswering = (answer: unknown): StorySource => ({
  id: "kit",
  name: "Kit",
  files: [
    { index: {}, stories: {}, docs: {}, code: {}, pages: {}, usage: async (): Promise<unknown> => answer }
  ],
  sheets: { required: [], theme: [], restyled: [] }
});

describe("packedUsage", () => {
  it("writes each title and list once, and reads back the same index", () => {
    const stories = ["Default", "Disabled"];
    const index = {
      "Inputs/Button": [
        { title: "Forms/Form", isDirect: true, stories },
        { title: "Layout/Card", isDirect: false, stories }
      ],
      "Inputs/Icon": [{ title: "Forms/Form", isDirect: false, stories }]
    };
    const packed = packedUsage(index);
    expect(packed.titles).toEqual(["Forms/Form", "Layout/Card"]);
    expect(packed.lists).toHaveLength(1);
    expect(unpackedUsage(packed)).toEqual(index);
  });
});

describe("sourceUsage", () => {
  it("reads a plain index whose components are named like the packed fields", async () => {
    const plain = { titles: [{ title: "A/B", isDirect: true, stories: ["Default"] }], lists: [], users: [] };
    expect(await sourceUsage(sourceAnswering(plain))).toEqual(plain);
  });

  it("says a malformed packed index is none, without throwing", async () => {
    const malformed = [
      { titles: ["A"], lists: [["Default"]], users: { B: [[0, 1]] } },
      { titles: ["A"], lists: [["Default"]], users: { B: "nope" } },
      { titles: [1], lists: [["Default"]], users: { B: [[0, 1, 0]] } },
      { titles: ["A"], lists: [["Default"]], users: { B: [[3, 1, 0]] } }
    ];
    for (const answer of malformed)
      expect(await sourceUsage(sourceAnswering(answer))).toBe(
        "A usage module answered something that is not a usage index"
      );
  });
});
