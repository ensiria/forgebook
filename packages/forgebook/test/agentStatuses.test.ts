/**
 * The statuses in the agents' answers, as an agent reads them: each component's and story's `statuses`, the tag filter
 * keeping them, and a story's answer naming where its TSDoc and its meta disagree about deprecation.
 *
 * @module
 */
import type { StorySource } from "@forgebook/story-format/source";
import { describe, expect, it } from "vitest";

import { catalogueStatuses } from "../src/storyStatuses.ts";
import { findStory, storyTree } from "../src/storyTree.ts";
import {
  type CataloguePages,
  filteredStories,
  storiesDocument,
  storyDocument
} from "../src/vite/agentApi.ts";
import { deprecationMismatch, storiesWithStatus, storyWithStatus } from "../src/vite/agentStatuses.ts";

/** Where the catalogue is served in these tests. */
const PAGES: CataloguePages = { page: "http://localhost:5173/", frame: "http://localhost:5173/frame.html" };

/** A card waiting for review with one experimental story, and a plain button. */
const SOURCE: StorySource = {
  id: "kit",
  name: "Kit",
  files: [
    {
      index: {
        "./card.stories.tsx": {
          title: "Layout/Card",
          tags: ["review"],
          stories: [
            { exportName: "Plain", tags: ["review"] },
            { exportName: "Flipped", tags: ["review", "experimental", "wip"] }
          ]
        },
        "./button.stories.tsx": { title: "Actions/Button", stories: [{ exportName: "Primary" }] }
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
const STATUSES = catalogueStatuses();

describe("storiesWithStatus", () => {
  const document = storiesWithStatus(storiesDocument("Kit", TREE, PAGES, ""), TREE, STATUSES);
  const [button, card] = document.components;

  it("gives a component its meta's statuses and a story its own, and nothing to what has none", () => {
    expect(card?.statuses).toEqual(["review"]);
    expect(card?.stories.map((story) => story.statuses)).toEqual([["review"], ["review", "experimental"]]);
    expect(button).not.toHaveProperty("statuses");
    expect(button?.stories[0]).not.toHaveProperty("statuses");
  });

  it("is filtered as any tag is: a status is one", () => {
    const filtered = filteredStories(document, { tags: ["experimental"] });
    expect(filtered.components.map((component) => [component.title, component.statuses])).toEqual([
      ["Layout/Card", ["review"]]
    ]);
    expect(filtered.components[0]?.stories.map((story) => story.name)).toEqual(["Flipped"]);
  });

  it("leaves the document as it is for a catalogue that turns every status off", () => {
    const plain = storiesDocument("Kit", TREE, PAGES, "");
    const none = catalogueStatuses({ review: false, experimental: false, deprecated: false });
    expect(storiesWithStatus(plain, TREE, none)).toBe(plain);
  });
});

describe("deprecationMismatch", () => {
  const docs = { name: "Card", description: "", summary: "", props: [], parts: [], subcomponents: [] };
  const deprecated = { ...docs, guidance: { deprecated: "Use Panel." } };

  it("names the meta when only the TSDoc deprecates, and the TSDoc when only the meta does", () => {
    expect(deprecationMismatch("Layout/Card", false, deprecated)).toMatch(
      /add tags: \["deprecated"\] to its meta/
    );
    expect(deprecationMismatch("Layout/Card", true, docs)).toMatch(/its TSDoc has no @deprecated/);
  });

  it("says nothing when both agree, or with no docs to read", () => {
    expect(deprecationMismatch("Layout/Card", true, deprecated)).toBeUndefined();
    expect(deprecationMismatch("Layout/Card", false, docs)).toBeUndefined();
    expect(deprecationMismatch("Layout/Card", true, undefined)).toBeUndefined();
  });
});

describe("storyWithStatus", () => {
  const location = findStory(TREE, "kit:layout-card--flipped");
  if (location === undefined) throw new Error("the fixture's story is missing");
  const docs = {
    name: "Card",
    description: "",
    summary: "",
    props: [],
    parts: [],
    subcomponents: [],
    guidance: { deprecated: "Use Panel." }
  };
  const document = storyDocument(location, { module: { value: {} }, docs: { value: docs } }, PAGES, "");

  it("gives the component as deprecated when its TSDoc says so, and names the meta to tag", () => {
    const answer = storyWithStatus(document, location.component, STATUSES);
    expect(answer.story.statuses).toEqual(["review", "experimental"]);
    expect(answer.component.statuses).toEqual(["review", "deprecated"]);
    expect(answer.problems.at(-1)).toMatch(/Layout\/Card is @deprecated in its TSDoc/);
  });

  it("reads no deprecation from the TSDoc where the catalogue turned the status off", () => {
    const answer = storyWithStatus(document, location.component, catalogueStatuses({ deprecated: false }));
    expect(answer.component.statuses).toEqual(["review"]);
    expect(answer.problems).toEqual(document.problems);
  });
});
