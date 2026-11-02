/**
 * Tests for the "Used in" index as a module writes it: packed once per title and list, read back the same.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { packedUsage, unpackedUsage } from "../src/usedIn.ts";

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
