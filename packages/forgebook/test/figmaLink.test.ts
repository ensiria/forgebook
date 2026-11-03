/**
 * Tests for a design's link: what is accepted as Figma's, and the embed's address made from it.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type FigmaLink, figmaLink } from "../src/figmaLink.ts";
import { figmaEmbedAddress } from "../src/shell/figmaEmbed.ts";

/**
 * Reads a link that must be valid.
 *
 * @param text - the link.
 */
const valid = (text: string): FigmaLink => {
  const link = figmaLink(text);
  if (typeof link === "string") throw new Error(link);
  return link;
};

describe("figmaLink", () => {
  it("reads a node's link, its node in the form Figma's API writes", () => {
    expect(figmaLink("https://www.figma.com/design/AbC123/Kit?node-id=12-34&t=x1")).toEqual({
      url: "https://www.figma.com/design/AbC123?node-id=12-34",
      kind: "design",
      fileKey: "AbC123",
      nodeId: "12:34"
    });
  });

  it("reads a whole file, a branch, an instance's node and every kind Figma embeds", () => {
    expect(valid("https://figma.com/design/AbC123").nodeId).toBeUndefined();
    expect(valid("https://www.figma.com/design/AbC123/branch/Br4nch/Kit").branchKey).toBe("Br4nch");
    expect(valid("https://www.figma.com/design/AbC123/Kit?node-id=I1-2%3B3-4").nodeId).toBe("I1:2;3:4");
    expect(valid("https://www.figma.com/file/AbC123/Kit").kind).toBe("design");
    expect(valid("https://embed.figma.com/proto/AbC123?embed-host=x").kind).toBe("proto");
    for (const kind of ["board", "slides", "deck"]) {
      expect(valid(`https://www.figma.com/${kind}/AbC123`).kind).toBe(kind);
    }
  });

  it.each([
    ["not an address", "figma.com/design/AbC123"],
    ["another scheme", "javascript:alert(1)"],
    ["plain http", "http://www.figma.com/design/AbC123"],
    ["a look-alike host", "https://www.figma.com.evil.example/design/AbC123"],
    ["a host ending like it", "https://evilfigma.com/design/AbC123"],
    ["a subdomain nobody embeds from", "https://api.figma.com/design/AbC123"],
    ["a host hidden behind a user name", "https://www.figma.com@evil.example/design/AbC123"],
    ["a user name on the host", "https://user@www.figma.com/design/AbC123"],
    ["a port", "https://www.figma.com:8443/design/AbC123"],
    ["a page that is no file", "https://www.figma.com/community/file/123"],
    ["a kind the embed lacks", "https://www.figma.com/make/AbC123"],
    ["an object's own key as a kind", "https://www.figma.com/constructor/AbC123"],
    ["a key that climbs the path", "https://www.figma.com/design/..%2F..%2Fevil"],
    ["no key", "https://www.figma.com/design/"],
    ["a node that is none", "https://www.figma.com/design/AbC123?node-id=%22%3E%3Cscript%3E"],
    ["two nodes", "https://www.figma.com/design/AbC123?node-id=1-2&node-id=3-4"],
    ["a branch that is none", "https://www.figma.com/design/AbC123/branch/bad!/Kit"]
  ])("refuses %s", (_case, text) => {
    expect(typeof figmaLink(text)).toBe("string");
  });
});

describe("figmaLink's link", () => {
  it("keeps only what was checked: no other parameter, path or fragment of what the story wrote", () => {
    const link = valid(
      "https://embed.figma.com/design/AbC123/..%2f..%2fexit?url=https://evil.example&node-id=1-2&a=[x](y)#z"
    );
    expect(link.url).toBe("https://www.figma.com/design/AbC123?node-id=1-2");
    expect(valid("https://www.figma.com/file/AbC123/Kit").url).toBe("https://www.figma.com/design/AbC123");
    expect(valid("https://www.figma.com/design/AbC123/branch/Br4nch/Kit").url).toBe(
      "https://www.figma.com/design/AbC123/branch/Br4nch"
    );
  });

  it("says why on one line, shortened, whatever the link holds", () => {
    const message = figmaLink(`https://evil.example/\n\u001b[31m${"x".repeat(500)}`);
    expect(message).not.toContain("\n");
    expect(message).not.toContain("\u001b");
    expect(String(message).length).toBeLessThan(200);
  });
});

describe("figmaEmbedAddress", () => {
  it("frames the node from Figma's embed host, named as Figma requires, in the shell's scheme", () => {
    const address = new URL(
      figmaEmbedAddress(valid("https://www.figma.com/design/AbC123/Kit?node-id=12-34&t=x1"), true)
    );
    expect(address.origin).toBe("https://embed.figma.com");
    expect(address.pathname).toBe("/design/AbC123");
    expect(Object.fromEntries(address.searchParams)).toEqual({
      "embed-host": "forgebook",
      theme: "dark",
      "node-id": "12:34"
    });
  });

  it("names a design by the kind the embed knows, and keeps a branch", () => {
    expect(figmaEmbedAddress(valid("https://www.figma.com/file/AbC123/Kit"), false)).toBe(
      "https://embed.figma.com/design/AbC123?embed-host=forgebook&theme=light"
    );
    expect(
      figmaEmbedAddress(valid("https://www.figma.com/design/AbC123/branch/Br4nch/Kit"), false)
    ).toContain("/design/AbC123/branch/Br4nch?");
  });
});
