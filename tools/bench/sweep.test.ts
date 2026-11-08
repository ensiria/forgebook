/**
 * What a sweep reads from the catalogue's document, and how it groups failures.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { failuresOf, HAS_STATUS, hasGivenUp, storiesOfDocument, sweepProblems } from "./sweep.ts";

/** The wait's expression, run on a frame with this status, or with no root at all, as a page runs it. */
const hasStatus = (status: string | null | undefined): unknown =>
  new Function("document", `return ${HAS_STATUS};`)({
    documentElement: status === undefined ? null : { getAttribute: (): string | null => status }
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

  it("is false, and does not throw, while a reloading frame has no root: a throw would end the wait at once", () => {
    expect(hasStatus(undefined)).toBe(false);
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

describe("sweepProblems", () => {
  const upstream = ["s:grid--min-max", "s:grid--static"];

  it("passes a run whose only failures fail in the library's own Storybook too", () => {
    expect(sweepProblems({ listed: 10, notDrawn: upstream }, 10, upstream)).toEqual([]);
  });

  it("counts every other story that did not draw", () => {
    expect(sweepProblems({ listed: 10, notDrawn: ["s:a--b", ...upstream] }, 10, upstream)).toEqual([
      "1 of 10 stories did not draw"
    ]);
  });

  it("fails a run where a story said to fail in Storybook drew, so the definition is corrected", () => {
    expect(sweepProblems({ listed: 10, notDrawn: ["s:grid--static"] }, 10, upstream)).toEqual([
      "s:grid--min-max drew, though the definition says it fails in Storybook"
    ]);
  });

  it("still counts the stories not listed, and those listed beyond the count", () => {
    expect(sweepProblems({ listed: 8, notDrawn: [] }, 10, [])).toEqual(["2 of 10 stories were not listed"]);
    expect(sweepProblems({ listed: 11, notDrawn: [] }, 10, [])).toEqual([
      "1 stories were listed beyond the 10 expected"
    ]);
  });
});
