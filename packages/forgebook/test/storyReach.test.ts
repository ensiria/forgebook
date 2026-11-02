/**
 * Tests for which stories a change touches: from the files a change names to the stories that reach them.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { affectedStories, storyReach } from "../src/vite/storyReach.ts";
import type { UsageGraph } from "../src/vite/usageGraph.ts";

const BUTTON = { file: "/p/src/Button.tsx", name: "Button" };
const CARD = { file: "/p/src/Card.tsx", name: "Card" };

/** A card that uses a button that imports a helper, and a button's own stories. */
const GRAPH: UsageGraph = {
  files: [
    {
      storyFile: "/p/src/Button.stories.tsx",
      component: BUTTON,
      stories: [{ exportName: "Plain", renders: [BUTTON] }]
    },
    {
      storyFile: "/p/src/Card.stories.tsx",
      component: CARD,
      stories: [
        { exportName: "Plain", renders: [CARD] },
        { exportName: "Empty", renders: [] }
      ]
    }
  ],
  imports: {
    "/p/src/Button.tsx": ["/p/src/classes.ts"],
    "/p/src/Card.tsx": ["/p/src/Button.tsx"],
    "/p/src/classes.ts": []
  }
};

const REACH = storyReach(GRAPH, [
  { storyFile: "/p/src/Button.stories.tsx", title: "Actions/Button" },
  { storyFile: "/p/src/Card.stories.tsx", title: "Layout/Card" }
]);

const names = (changed: readonly string[]): string[] =>
  affectedStories(REACH, changed).map((story) => `${story.title} ${story.exportName}`);

describe("affectedStories", () => {
  it("finds every story that reaches a shared file, through what imports it", () => {
    expect(names(["/p/src/classes.ts"])).toEqual([
      "Actions/Button Plain",
      "Layout/Card Plain",
      "Layout/Card Empty"
    ]);
  });

  it("finds only a component's own users for an edit of that component", () => {
    expect(names(["/p/src/Card.tsx"])).toEqual(["Layout/Card Plain", "Layout/Card Empty"]);
  });

  it("finds a story file's stories for an edit of the file itself", () => {
    expect(names(["/p/src/Button.stories.tsx"])).toEqual(["Actions/Button Plain"]);
  });

  it("finds nothing for a file no story reaches", () => {
    expect(names(["/p/README.md"])).toEqual([]);
  });

  it("gives each story once, whatever number of its files changed", () => {
    expect(names(["/p/src/classes.ts", "/p/src/Button.tsx"])).toHaveLength(3);
  });
});
