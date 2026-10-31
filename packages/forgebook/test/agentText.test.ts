/**
 * Tests for the answers of `forgebook stories` and `forgebook story` as text.
 *
 * @module
 */
import type { OutputStyle } from "@ensiria/cli-kit/log.types";
import { describe, expect, it } from "vitest";

import { storiesText } from "../bin/forgebook/agentText.ts";
import type { StoriesDocument } from "../src/vite/agent.types.ts";

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
          links: {
            address: "http://localhost:5173/?story=x",
            frame: "http://localhost:5173/frame.html?story=x"
          }
        }
      ]
    }
  ],
  problems: []
};

describe("storiesText", () => {
  it("never cuts an id, however narrow the terminal, and marks an unlisted story", () => {
    const text = storiesText(DOCUMENT, NARROW);
    expect(text).toContain("kit:inputs-selection-select--overlay-in-room");
    expect(text).toContain("Inputs/Selection/Select › Overlay in room (unlisted)");
  });
});
