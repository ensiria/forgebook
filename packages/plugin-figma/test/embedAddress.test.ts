/**
 * Tests for the address that frames a design from Figma.
 *
 * @module
 */
import type { FigmaLink } from "@forgebook/story-format/source";
import { describe, expect, it } from "vitest";

import { figmaEmbedAddress } from "../src/embedAddress.ts";

/** A link to a node of a file. */
const NODE: FigmaLink = {
  url: "https://www.figma.com/design/AbC123/Kit?node-id=12-34",
  kind: "design",
  fileKey: "AbC123",
  nodeId: "12:34"
};

describe("figmaEmbedAddress", () => {
  it("frames the node from Figma's embed host, named as Figma requires, in the shell's scheme", () => {
    const address = new URL(figmaEmbedAddress(NODE, true));
    expect(address.origin).toBe("https://embed.figma.com");
    expect(address.pathname).toBe("/design/AbC123");
    expect(Object.fromEntries(address.searchParams)).toEqual({
      "embed-host": "forgebook",
      theme: "dark",
      "node-id": "12:34"
    });
  });

  it("names a design by the kind the embed knows, and keeps a branch", () => {
    const { nodeId: _nodeId, ...file } = NODE;
    expect(figmaEmbedAddress(file, false)).toBe(
      "https://embed.figma.com/design/AbC123?embed-host=forgebook&theme=light"
    );
    expect(figmaEmbedAddress({ ...file, branchKey: "Br4nch" }, false)).toContain(
      "/design/AbC123/branch/Br4nch?"
    );
  });
});
