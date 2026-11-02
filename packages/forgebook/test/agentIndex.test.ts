/**
 * Tests for answering from a built catalogue's index: the links come from where it is read, and what needs a server says so.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { AgentIndex } from "../src/vite/agentIndex.ts";
import { indexAnswer, indexProblems, isAgentIndex } from "../src/vite/agentIndex.ts";

const STORY_ID = "kit:badge--plain";

const WRITTEN: unknown = {
  schema: 1,
  stories: {
    schema: 1,
    title: "Kit",
    sources: [],
    components: [
      {
        id: "kit:badge",
        title: "Badge",
        source: "kit",
        file: "Badge.stories.tsx",
        usedIn: [],
        stories: [{ id: STORY_ID, name: "Plain", exportName: "Plain", links: { address: "", frame: "" } }]
      }
    ],
    problems: []
  },
  details: {
    [STORY_ID]: {
      schema: 1,
      story: { id: STORY_ID, links: { address: "", frame: "" } },
      problems: ["it broke"]
    }
  },
  findable: [{ id: "kit:badge", title: "Badge", keywords: ["pill"], stories: [], story: STORY_ID }],
  tokens: { tokens: [], problems: ["no file"], clashes: [], unread: [], isConfigured: false },
  problems: []
};

/** The index, read as a client reads it. */
const readIndex = (): AgentIndex => {
  if (!isAgentIndex(WRITTEN)) throw new Error("not an index");
  return WRITTEN;
};

const INDEX = readIndex();

const PAGES = { page: "https://ui.example.com/", frame: "https://ui.example.com/frame.html" };

describe("indexAnswer", () => {
  it("makes a story's links from where the catalogue is read, in the view asked for", () => {
    const params = new URLSearchParams({ id: STORY_ID, view: "theme=dark" });
    expect(indexAnswer(INDEX, PAGES, "story", params).body).toMatchObject({
      story: {
        links: { address: `https://ui.example.com/?theme=dark&story=${encodeURIComponent(STORY_ID)}` }
      }
    });
  });

  it("does not find a story by a name every object has", () => {
    expect(indexAnswer(INDEX, PAGES, "story", new URLSearchParams({ id: "constructor" })).status).toBe(404);
  });

  it('gives "Used in" only when asked for, as a dev server does', () => {
    const plain = JSON.stringify(indexAnswer(INDEX, PAGES, "stories", new URLSearchParams()).body);
    const asked = indexAnswer(INDEX, PAGES, "stories", new URLSearchParams({ usedIn: "true" })).body;
    expect(plain).not.toContain("usedIn");
    expect(JSON.stringify(asked)).toContain("usedIn");
  });

  it("finds a component by its keywords, with its first story", () => {
    expect(indexAnswer(INDEX, PAGES, "find", new URLSearchParams({ query: "pill" })).body).toMatchObject({
      components: [{ title: "Badge", story: STORY_ID }]
    });
  });

  it("says a built catalogue cannot do what needs a server", () => {
    expect(indexAnswer(INDEX, PAGES, "changed", new URLSearchParams()).status).toBe(404);
    expect(indexAnswer(INDEX, PAGES, "toString", new URLSearchParams()).status).toBe(404);
  });

  it("collects every problem the file holds, for whoever builds it", () => {
    expect(indexProblems(INDEX)).toEqual(["no file", `${STORY_ID}: it broke`]);
  });

  it("refuses a file of another shape", () => {
    expect(isAgentIndex({ schema: 2 })).toBe(false);
    expect(isAgentIndex(INDEX)).toBe(true);
  });
});
