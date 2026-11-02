/**
 * Tests for the answers of `forgebook stories` and `forgebook story` as text.
 *
 * @module
 */
import type { OutputStyle } from "@ensiria/cli-kit/log.types";
import { describe, expect, it } from "vitest";

import { clashText, storiesText, storyText } from "../bin/forgebook/agentText.ts";
import type { StoriesDocument, StoryDocument } from "../src/vite/agent.types.ts";

/** A narrow terminal without colours. */
const NARROW: OutputStyle = { color: false, unicode: true, width: 30 };

/** One component with a story whose id is longer than the terminal. */
const DOCUMENT: StoriesDocument = {
  schema: 1,
  title: "Kit",
  sources: [{ id: "kit", name: "Kit" }],
  components: [
    {
      id: "kit:inputs-selection-select",
      title: "Inputs/Selection/Select",
      source: "kit",
      file: "./select.stories.tsx",
      stories: [
        {
          id: "kit:inputs-selection-select--overlay-in-room",
          name: "Overlay in room",
          exportName: "OverlayInRoom",
          description: undefined,
          tags: [],
          isUnlisted: true,
          isLogic: false,
          hasPlay: false,
          links: {
            address: "http://localhost:5173/?story=x",
            component: "http://localhost:5173/?component=x",
            frame: "http://localhost:5173/frame.html?story=x",
            embed: "http://localhost:5173/?embed&story=x"
          }
        }
      ]
    }
  ],
  problems: []
};

describe("storyText", () => {
  it("gives the design's link, whole, when the story has one", () => {
    const [component] = DOCUMENT.components;
    const story = component?.stories[0];
    if (component === undefined || story === undefined) throw new Error("the fixture's story is missing");
    const document: StoryDocument = {
      schema: 1,
      story,
      component,
      docs: undefined,
      args: {},
      problems: [],
      design: {
        figma: "https://www.figma.com/design/File1",
        fileKey: "File1",
        address: "http://x/?tab=design"
      }
    };
    const wide: OutputStyle = { ...NARROW, width: 120 };
    expect(storyText(document, wide)).toContain("https://www.figma.com/design/File1");
    const { design: _design, ...withoutDesign } = document;
    expect(storyText(withoutDesign, wide)).not.toContain("Design");
  });
});

describe("storiesText", () => {
  it("never cuts an id, however narrow the terminal, and marks an unlisted story", () => {
    const text = storiesText(DOCUMENT, NARROW);
    expect(text).toContain("kit:inputs-selection-select--overlay-in-room");
    expect(text).toContain("Inputs/Selection/Select › Overlay in room (unlisted)");
  });
});

describe("clashText", () => {
  it("says which file stands, in which theme", () => {
    expect(
      clashText({ name: "a", mode: "dark", kept: "own.json", replaced: ["lib: a.json", "b.json"] })
    ).toBe("a (dark): own.json replaces lib: a.json, b.json");
  });
});
