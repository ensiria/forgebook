/**
 * The tag filter on a small tree: what it keeps, what it lists, and that a tree with no filter stays itself.
 *
 * @module
 */
import type { StorySource } from "@forgebook/story-format/source";
import { describe, expect, it } from "vitest";

import { isFilterTag } from "../src/storyTagNames.ts";
import { catalogueTags, passesTags, taggedTree } from "../src/storyTags.ts";
import { storyTree } from "../src/storyTree.ts";

const noLoad = (): Promise<unknown> => Promise.resolve({});

const source: StorySource = {
  id: "ui",
  name: "UI",
  sheets: { required: [], theme: [], restyled: [] },
  files: [
    {
      index: {
        "button.stories.tsx": {
          title: "Inputs/Button",
          stories: [
            { exportName: "Primary", tags: ["autodocs", "beta"] },
            { exportName: "Quiet", tags: ["stable"] },
            { exportName: "Hidden", tags: ["!dev", "beta"] }
          ]
        },
        "card.stories.tsx": {
          title: "Layout/Card",
          alsoIn: ["Inputs/Containers"],
          stories: [{ exportName: "Plain", tags: ["wip"] }]
        }
      },
      stories: { "button.stories.tsx": noLoad, "card.stories.tsx": noLoad },
      docs: {},
      code: {},
      pages: {}
    }
  ]
};

const tree = storyTree([source]);

/** The stories' names the filter leaves, by component. */
const listed = (filter: readonly string[]): Readonly<Record<string, readonly string[]>> =>
  Object.fromEntries(
    taggedTree(tree, filter).sources.flatMap((each) =>
      each.families.flatMap((family) =>
        family.groups.flatMap((group) =>
          group.components.map((component) => [component.name, component.stories.map((story) => story.name)])
        )
      )
    )
  );

describe("isFilterTag", () => {
  it("offers a story's own tags, and no tool's tag or a tag taken away", () => {
    expect(["beta", "autodocs", "dev", "test", "play-fn", "!beta"].filter(isFilterTag)).toEqual(["beta"]);
  });
});

describe("passesTags", () => {
  it("keeps a story holding any tag asked for and none left out", () => {
    expect(passesTags(["a"], [])).toBe(true);
    expect(passesTags(["a"], ["a", "b"])).toBe(true);
    expect(passesTags(["c"], ["a", "b"])).toBe(false);
    expect(passesTags(["a", "b"], ["a", "!b"])).toBe(false);
    expect(passesTags([], ["!b"])).toBe(true);
  });
});

describe("catalogueTags", () => {
  it("lists the tags by name, counting the listed stories only", () => {
    expect(catalogueTags(tree)).toEqual([
      { tag: "beta", stories: 1 },
      { tag: "stable", stories: 1 },
      { tag: "wip", stories: 1 }
    ]);
  });
});

describe("taggedTree", () => {
  it("gives the same tree with no filter", () => {
    expect(taggedTree(tree, [])).toBe(tree);
  });

  it("keeps only the stories that pass, and what holds them", () => {
    expect(listed(["beta"])).toEqual({ Button: ["Primary"] });
    expect(listed(["beta", "wip"])).toEqual({ Button: ["Primary"], Card: ["Plain"] });
    expect(listed(["!wip"])).toEqual({ Button: ["Primary", "Quiet"] });
  });

  it("drops an alias with its component", () => {
    const aliasesOf = (filter: readonly string[]): readonly string[] =>
      taggedTree(tree, filter).sources.flatMap((each) =>
        each.families.flatMap((family) =>
          family.groups.flatMap((group) => group.aliases.map((alias) => alias.name))
        )
      );
    expect(aliasesOf(["wip"])).toEqual(["Card"]);
    expect(aliasesOf(["beta"])).toEqual([]);
  });
});
