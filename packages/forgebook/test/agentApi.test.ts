/**
 * Tests for the documents the catalogue answers tools and agents with.
 *
 * @module
 */

import type { StorySource } from "@forgebook/story-format/source";
import { describe, expect, it } from "vitest";

import { findStory, storyTree } from "../src/storyTree.ts";
import {
  type CataloguePages,
  filteredStories,
  jsonValue,
  type LoadedStoryParts,
  storiesDocument,
  storyDocument,
  storyLinks
} from "../src/vite/agentApi.ts";
import { rootHeaderValue } from "../src/vite/agentRoutes.ts";

/** Where the catalogue is served in these tests. */
const PAGES: CataloguePages = { page: "http://localhost:5173/", frame: "http://localhost:5173/frame.html" };

/** A source with a button (one listed story, one `!dev`), a page without a component, and a title taken twice. */
const SOURCE: StorySource = {
  id: "kit",
  name: "Kit",
  files: [
    {
      index: {
        "./button.stories.tsx": {
          title: "Actions/Button",
          stories: [
            { exportName: "Primary", description: "The main action." },
            { exportName: "Internal", tags: ["!dev"] }
          ]
        },
        "./colour.stories.tsx": { title: "Foundations/Colour", stories: [{ exportName: "Scales" }] },
        "./again.stories.tsx": { title: "Actions/Button", stories: [{ exportName: "Twice" }] }
      },
      stories: {},
      docs: {},
      code: {},
      pages: {}
    }
  ],
  sheets: { required: [], theme: [], restyled: [] }
};

const TREE = storyTree([SOURCE]);

describe("storyLinks", () => {
  it("opens the story's page and its frame in the view asked for, the shell's own parameters off the frame", () => {
    expect(storyLinks(PAGES, "kit:actions-button--primary", "theme=dark&lang=it&panel=props")).toEqual({
      address: "http://localhost:5173/?theme=dark&lang=it&panel=props&story=kit%3Aactions-button--primary",
      component: "http://localhost:5173/?theme=dark&lang=it&panel=props&component=kit%3Aactions-button",
      frame: "http://localhost:5173/frame.html?theme=dark&lang=it&story=kit%3Aactions-button--primary",
      embed: "http://localhost:5173/?embed&theme=dark&lang=it&story=kit%3Aactions-button--primary"
    });
  });
});

describe("a source with `--` in its id", () => {
  it("still names the component's page", () => {
    expect(storyLinks(PAGES, "my--lib:button--primary", "").component).toBe(
      "http://localhost:5173/?component=my--lib%3Abutton"
    );
  });
});

describe("an audience in the view", () => {
  it("opens the component's page for them, and leaves the story's frame alone", () => {
    const links = storyLinks(PAGES, "kit:actions-button--primary", "audience=designer");
    expect(links.component).toBe("http://localhost:5173/?audience=designer&component=kit%3Aactions-button");
    expect(links.frame).toBe("http://localhost:5173/frame.html?story=kit%3Aactions-button--primary");
  });
});

describe("storiesDocument", () => {
  const document = storiesDocument("Kit catalogue", TREE, PAGES, "");

  it("lists each component with its stories, the unlisted ones last and marked", () => {
    const button = document.components.find((component) => component.title === "Actions/Button");
    expect(button?.id).toBe("kit:actions-button");
    expect(button?.stories.map((story) => [story.id, story.isUnlisted])).toEqual([
      ["kit:actions-button--primary", false],
      ["kit:actions-button--internal", true]
    ]);
    expect(button?.stories[0]?.description).toBe("The main action.");
  });

  it("carries the schema, the sources and the index's problems", () => {
    expect(document.schema).toBe(1);
    expect(document.sources).toEqual([{ id: "kit", name: "Kit" }]);
    expect(document.problems.join("\n")).toContain("again.stories.tsx");
  });
});

describe("storyDocument", () => {
  const location = findStory(TREE, "kit:actions-button--primary");
  if (location === undefined) throw new Error("the fixture's story is missing");
  /** A component's docs as the plugin answers them. */
  const buttonDocs = {
    name: "Button",
    description: "",
    summary: "",
    props: [],
    parts: [],
    subcomponents: []
  };

  it("merges the meta's args under the story's and keeps only what JSON can write", () => {
    const module = {
      default: { title: "Actions/Button", args: { size: "md", onPress: () => undefined } },
      Primary: { args: { label: "Save" } }
    };
    const document = storyDocument(
      location,
      { module: { value: module }, docs: { value: buttonDocs } },
      PAGES,
      ""
    );
    expect(document.args).toEqual({ size: "md", label: "Save" });
    expect(document.docs?.name).toBe("Button");
    expect(document.problems).toEqual([]);
  });

  it("says why it could not read the story instead of failing", () => {
    const document = storyDocument(
      location,
      { module: { error: "window is not defined" }, docs: { value: { error: "no program" } } },
      PAGES,
      "theme=dark"
    );
    expect(document.args).toEqual({});
    expect(document.docs).toBeUndefined();
    expect(document.problems).toEqual([
      "Its story file failed to load: window is not defined",
      "Its component's docs failed: no program"
    ]);
    expect(document.story.links.frame).toContain("theme=dark");
    expect(document.story.links.component).toContain("theme=dark");
    expect(document.story.links.component).toContain("component=");
    expect(document.story.links.component).not.toContain("--");
  });
});

describe("a story's design, for agents", () => {
  const figmaUrl = "https://www.figma.com/design/File1?node-id=12-34";
  const tree = storyTree([
    {
      ...SOURCE,
      files: [
        {
          ...(SOURCE.files[0] ?? { index: {}, stories: {}, docs: {}, code: {}, pages: {} }),
          index: {
            "./button.stories.tsx": {
              title: "Actions/Button",
              design: { figma: figmaUrl },
              stories: [{ exportName: "Primary" }]
            },
            "./colour.stories.tsx": { title: "Foundations/Colour", stories: [{ exportName: "Scales" }] }
          }
        }
      ]
    }
  ]);
  const parts = { module: { value: { default: {}, Primary: {}, Scales: {} } }, docs: { value: undefined } };

  it("gives its Figma link, what a tool that reads Figma takes, and the page to look at it on", () => {
    const location = findStory(tree, "kit:actions-button--primary");
    if (location === undefined) throw new Error("the fixture's story is missing");
    const document = storyDocument(location, parts, PAGES, "theme=dark");
    expect(document.design).toEqual({
      figma: figmaUrl,
      fileKey: "File1",
      nodeId: "12:34",
      address: "http://localhost:5173/?theme=dark&tab=figma&story=kit%3Aactions-button--primary"
    });
    expect(document.component.design).toEqual({ figma: figmaUrl, fileKey: "File1", nodeId: "12:34" });
  });

  it("says nothing of a design for a story without one, and lists a component's in the stories", () => {
    const location = findStory(tree, "kit:foundations-colour--scales");
    if (location === undefined) throw new Error("the fixture's story is missing");
    expect("design" in storyDocument(location, parts, PAGES, "")).toBe(false);
    const [button, colour] = storiesDocument("Kit", tree, PAGES, "").components;
    expect(button?.design?.figma).toBe(figmaUrl);
    expect(colour === undefined ? true : "design" in colour).toBe(false);
  });
});

describe("jsonValue", () => {
  it("drops functions and cycles, keeps the rest", () => {
    const looped: { name: string; self?: unknown; run: () => void } = { name: "a", run: () => undefined };
    looped.self = looped;
    expect(jsonValue(looped)).toEqual({ name: "a" });
  });
});

describe("filteredStories", () => {
  const document = storiesDocument("Kit catalogue", TREE, PAGES, "");

  it("keeps the components whose title holds the text, any case, and the problems whole", () => {
    const kept = filteredStories(document, { component: "BUTTON" });
    expect(kept.components.map((component) => component.title)).toEqual(["Actions/Button"]);
    expect(kept.problems).toEqual(document.problems);
  });

  it("keeps one source's components", () => {
    expect(filteredStories(document, { source: "other" }).components).toEqual([]);
    expect(filteredStories(document, { source: "kit" }).components).toHaveLength(document.components.length);
  });
});

describe("Used in, for agents", () => {
  const usage = new Map([
    [
      "kit",
      {
        "Foundations/Colour": [
          { title: "Actions/Button", isDirect: true, stories: ["Primary", "Internal"] },
          // a component the tree no longer has is left out
          { title: "Gone/Away", isDirect: false, stories: ["Any"] }
        ]
      }
    ]
  ]);

  it("gives each component its users by id, with their stories' ids, only when asked for", () => {
    const colour = storiesDocument("Kit", TREE, PAGES, "", usage).components.find(
      (component) => component.title === "Foundations/Colour"
    );
    expect(colour?.usedIn).toEqual([
      {
        id: "kit:actions-button",
        title: "Actions/Button",
        isDirect: true,
        stories: ["kit:actions-button--primary", "kit:actions-button--internal"]
      }
    ]);
    expect(
      storiesDocument("Kit", TREE, PAGES, "").components.some((component) => "usedIn" in component)
    ).toBe(false);
  });

  it("gives a story's component its users when the catalogue offers them", () => {
    const location = findStory(TREE, "kit:foundations-colour--scales");
    if (location === undefined) throw new Error("no story");
    const index = usage.get("kit");
    if (index === undefined) throw new Error("no usage");
    const parts: LoadedStoryParts = { module: { value: {} }, docs: { value: { name: null } } };
    expect(storyDocument(location, parts, PAGES, "", { tree: TREE, index }).component.usedIn?.[0]?.id).toBe(
      "kit:actions-button"
    );
    expect(storyDocument(location, parts, PAGES, "").component).not.toHaveProperty("usedIn");
  });
});

describe("the root header", () => {
  it("carries any folder's name in Latin-1, and reads back as the folder", () => {
    for (const dir of ["/Users/x/Progetti è", "/Users/x/プロジェクト"]) {
      const value = rootHeaderValue(dir);
      expect([...value].every((character) => character.charCodeAt(0) < 128)).toBe(true);
      expect(decodeURIComponent(value)).toBe(dir);
    }
  });
});
