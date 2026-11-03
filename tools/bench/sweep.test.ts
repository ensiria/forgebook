/**
 * What a sweep reads from the catalogue's document, and how it groups failures.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { failuresOf, HAS_STATUS, hasGivenUp, storiesOfDocument } from "./sweep.ts";

/** The wait's expression, run on a frame with this status, as a page runs it. */
const hasStatus = (status: string | null): unknown =>
  new Function("document", `return ${HAS_STATUS};`)({
    documentElement: { getAttribute: (): string | null => status }
  });

describe("storiesOfDocument", () => {
  it("lists every component's stories with their frames", () => {
    const document = { components: [{ stories: [{ id: "a:b--c" }, { id: "a:b--d" }] }, { stories: [] }] };
    expect(storiesOfDocument(document, "http://host/").map((story) => story.frame)).toEqual([
      "http://host/frame.html?story=a%3Ab--c",
      "http://host/frame.html?story=a%3Ab--d"
    ]);
  });

  it("reads nothing from what is no document", () => {
    expect(storiesOfDocument(undefined, "http://host/")).toEqual([]);
  });
});

describe("hasGivenUp", () => {
  const failed = { failure: "boom" };

  it("gives up only when nothing drew, after a dozen stories", () => {
    expect(hasGivenUp(Array.from({ length: 11 }, () => failed))).toBe(false);
    expect(hasGivenUp(Array.from({ length: 12 }, () => failed))).toBe(true);
  });

  it("goes on through any number of failures once a story drew", () => {
    expect(hasGivenUp([{ failure: undefined }, ...Array.from({ length: 50 }, () => failed)])).toBe(false);
  });
});

describe("HAS_STATUS", () => {
  it("is false until the frame says something: a wait that returns at once would count every story as drawn", () => {
    expect(hasStatus(null)).toBe(false);
  });

  it("is true once the story is ready, or failed", () => {
    expect(hasStatus("ready")).toBe(true);
    expect(hasStatus("error")).toBe(true);
  });
});

describe("failuresOf", () => {
  it("takes the same cause at another address for one cause", () => {
    const failures = failuresOf([
      { id: "a", failure: "Failed to fetch http://127.0.0.1:1/a.js" },
      { id: "b", failure: "Failed to fetch http://127.0.0.1:1/b.js" }
    ]);
    expect(failures).toEqual([{ reason: "Failed to fetch <address>", stories: 2, example: "a" }]);
  });

  it("groups a cause however its numbers differ, the largest first, and leaves out what drew", () => {
    const failures = failuresOf([
      { id: "a", failure: "other" },
      { id: "b", failure: "line 12 failed" },
      { id: "c", failure: "line 40 failed" },
      { id: "d", failure: undefined }
    ]);
    expect(failures).toEqual([
      { reason: "line N failed", stories: 2, example: "b" },
      { reason: "other", stories: 1, example: "a" }
    ]);
  });
});
