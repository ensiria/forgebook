/**
 * Tests for a story check's shapes and the command's pure parts: the stories an id names, a report read back after
 * the dynamic import, and the report as text.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { checkText } from "../bin/forgebook/agentText.ts";
import { diffedComponent, storiesNamed } from "../bin/forgebook/storyCheckRun.ts";
import { isStoryCheckReport, type StoryCheckReport } from "../src/storyCheck.ts";
import type { StoriesDocument } from "../src/vite/agent.types.ts";

const LINKS = { address: "", frame: "", embed: "" };

const DOCUMENT: StoriesDocument = {
  schema: 1,
  title: "Kit",
  sources: [{ id: "kit", name: "Kit" }],
  components: [
    {
      id: "kit:actions-button",
      title: "Actions/Button",
      source: "kit",
      file: "./button.stories.tsx",
      files: ["./button.stories.tsx"],
      stories: [
        {
          id: "kit:actions-button--primary",
          name: "Primary",
          file: "./button.stories.tsx",
          exportName: "Primary",
          description: undefined,
          tags: [],
          isUnlisted: false,
          isLogic: false,
          links: LINKS,
          height: 120
        },
        {
          id: "kit:actions-button--internal",
          name: "Internal",
          file: "./button.stories.tsx",
          exportName: "Internal",
          description: undefined,
          tags: ["!dev"],
          isUnlisted: true,
          isLogic: false,
          links: LINKS
        }
      ]
    }
  ],
  problems: []
};

const REPORT: StoryCheckReport = {
  schema: 1,
  results: [
    { storyId: "kit:actions-button--primary", view: "", frame: "f", problems: [] },
    {
      storyId: "kit:actions-button--primary",
      view: "theme=dark",
      frame: "f",
      problems: [
        { kind: "axe", rule: "color-contrast", message: "color-contrast: Elements must meet contrast" }
      ]
    }
  ]
};

describe("storiesNamed", () => {
  it("gives a story by its id, unlisted or not, and a component's listed stories by the component's id", () => {
    expect(storiesNamed(DOCUMENT, "kit:actions-button--internal").map((story) => story.id)).toEqual([
      "kit:actions-button--internal"
    ]);
    expect(storiesNamed(DOCUMENT, "kit:actions-button").map((story) => story.id)).toEqual([
      "kit:actions-button--primary"
    ]);
    expect(storiesNamed(DOCUMENT, "kit:nothing")).toEqual([]);
  });

  it("takes the id an earlier rule gave a story or a component, and carries it for the pictures named by it", () => {
    const renamed: StoriesDocument = {
      ...DOCUMENT,
      components: [
        {
          id: "kit:data-readmore",
          title: "Data/ReadMore",
          source: "kit",
          file: "./read-more.stories.tsx",
          files: ["./read-more.stories.tsx"],
          stories: [
            {
              id: "kit:data-readmore--open",
              name: "Open",
              file: "./read-more.stories.tsx",
              exportName: "Open",
              description: undefined,
              tags: [],
              isUnlisted: false,
              isLogic: false,
              links: LINKS
            }
          ]
        }
      ]
    };
    expect(storiesNamed(renamed, "kit:data-read-more--open")).toEqual([
      { id: "kit:data-readmore--open", formerId: "kit:data-read-more--open" }
    ]);
    expect(storiesNamed(renamed, "kit:data-read-more").map((story) => story.id)).toEqual([
      "kit:data-readmore--open"
    ]);
    // a comparison of the component, asked by either id, owns the baselines under both
    const owners = { component: "kit:data-readmore", formerComponent: "kit:data-read-more" };
    expect(diffedComponent(renamed, "kit:data-read-more")).toEqual(owners);
    expect(diffedComponent(renamed, "kit:data-readmore")).toEqual(owners);
    expect(diffedComponent(renamed, "kit:data-readmore--open")).toEqual({});
  });
});

describe("isStoryCheckReport", () => {
  it("takes a report, and refuses what is not one", () => {
    expect(isStoryCheckReport(REPORT)).toBe(true);
    expect(isStoryCheckReport({ schema: 2, results: [] })).toBe(false);
    expect(
      isStoryCheckReport({
        schema: 1,
        results: [{ storyId: "a", view: "", frame: "f", problems: [{ kind: "smell", message: "?" }] }]
      })
    ).toBe(false);
  });
});

describe("checkText", () => {
  it("writes a row per problem, and one for a story that passes in a view", () => {
    const text = checkText(REPORT, { color: false, unicode: false, width: 200 });
    expect(text).toContain("default");
    expect(text).toContain("passes");
    expect(text).toContain("axe: color-contrast: Elements must meet contrast");
  });
});
