/**
 * Tests for the sidebar's search and the shell's keys.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { steppedStory, storyStep } from "../src/shell/keyboard.ts";
import { foundComponent, foundFamily, searchWords } from "../src/shell/treeSearch.ts";
import type { TreeComponent, TreeFamily } from "../src/storyTree.ts";

/** A component with a few stories. */
const BUTTON: TreeComponent = {
  name: "Button",
  title: "Actions/Buttons/Button",
  file: "Button.stories.tsx",
  stories: [
    {
      id: "kit:b--overview",
      name: "Overview",
      exportName: "Overview",
      controls: "all",
      group: undefined,
      description: undefined,
      isMain: false,
      isTouch: false,
      isLogic: false,
      height: undefined,
      tags: []
    },
    {
      id: "kit:b--danger",
      name: "Danger",
      exportName: "Danger",
      controls: "all",
      group: undefined,
      description: "A destructive action.",
      isMain: false,
      isTouch: false,
      isLogic: false,
      height: undefined,
      tags: []
    },
    {
      id: "kit:b--long",
      name: "Long label",
      exportName: "Long",
      controls: "all",
      group: "worst-case",
      description: "Ünbreakable text.",
      isMain: false,
      isTouch: false,
      isLogic: false,
      height: undefined,
      tags: []
    }
  ],
  unlisted: [],
  alsoIn: [],
  related: [],
  keywords: ["Pressable", "CTA"]
};

/** A family holding it, and an alias of a component that lives elsewhere. */
const ACTIONS: TreeFamily = {
  name: "Actions",
  groups: [
    {
      name: "Buttons",
      components: [BUTTON],
      aliases: [{ name: "SplitButton", title: "Recipes/SplitButton" }]
    }
  ]
};

describe("the sidebar's search", () => {
  it("splits the query into folded words", () => {
    expect(searchWords("  Bütton  DANGER ")).toEqual(["button", "danger"]);
    expect(searchWords("   ")).toEqual([]);
  });

  it("finds a component whole by its name or its title, in any order of words", () => {
    expect(foundComponent(BUTTON, searchWords("button"))).toBe(BUTTON);
    expect(foundComponent(BUTTON, searchWords("buttons actions"))).toBe(BUTTON);
  });

  it("finds a component whole by its meta's search words, folded", () => {
    expect(foundComponent(BUTTON, searchWords("pressable"))).toBe(BUTTON);
    expect(foundComponent(BUTTON, searchWords("cta actions"))).toBe(BUTTON);
  });

  it("keeps the stories that hold the words the component lacks, descriptions included", () => {
    expect(foundComponent(BUTTON, searchWords("button danger"))?.stories.map((story) => story.name)).toEqual([
      "Danger"
    ]);
    expect(foundComponent(BUTTON, searchWords("destructive"))?.stories.map((story) => story.name)).toEqual([
      "Danger"
    ]);
    expect(foundComponent(BUTTON, searchWords("unbreakable"))?.stories.map((story) => story.name)).toEqual([
      "Long label"
    ]);
    expect(foundComponent(BUTTON, searchWords("select"))).toBeUndefined();
  });

  it("finds an alias whole by its name, the place it is listed in or the place it lives in", () => {
    const aliasesOf = (query: string): readonly string[] | undefined =>
      foundFamily(ACTIONS, searchWords(query))?.groups[0]?.aliases.map((alias) => alias.name);
    expect(aliasesOf("split")).toEqual(["SplitButton"]);
    expect(aliasesOf("recipes")).toEqual(["SplitButton"]);
    expect(aliasesOf("actions buttons")).toEqual(["SplitButton"]);
    expect(aliasesOf("danger")).toEqual([]);
    expect(foundFamily(ACTIONS, searchWords("recipes"))?.groups[0]?.components).toEqual([]);
  });

  it("leaves a family as it is for no words and drops it when nothing matches", () => {
    expect(foundFamily(ACTIONS, [])).toBe(ACTIONS);
    expect(foundFamily(ACTIONS, searchWords("table"))).toBeUndefined();
  });
});

describe("the shell's keys", () => {
  const key = (value: string, modifiers: Partial<KeyboardEvent> = {}): Parameters<typeof storyStep>[0] => ({
    key: value,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: null,
    ...modifiers
  });

  it("reads [ and ] as steps, and nothing with a modifier", () => {
    expect(storyStep(key("["))).toBe(-1);
    expect(storyStep(key("]"))).toBe(1);
    expect(storyStep(key("]", { metaKey: true }))).toBeUndefined();
    expect(storyStep(key("a"))).toBeUndefined();
  });

  it("steps to the neighbour, stops at the ends, and starts a component's page at its first story", () => {
    const ids = ["a", "b", "c"];
    expect(steppedStory(ids, "b", 1, undefined)).toBe("c");
    expect(steppedStory(ids, "b", -1, undefined)).toBe("a");
    expect(steppedStory(ids, "c", 1, undefined)).toBeUndefined();
    expect(steppedStory(ids, undefined, 1, "b")).toBe("b");
  });
});
