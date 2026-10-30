/**
 * Tests for the home's recent pages: the newest first, a page once, the oldest dropped past the limit.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type RecentPage, withRecentPage } from "../src/shell/useRecentPages";

/** A story's page. */
const story = (id: string): RecentPage => ({ kind: "story", id });

describe("withRecentPage", () => {
  it("puts the page opened first, once", () => {
    expect(withRecentPage([story("a"), story("b")], story("b"))).toEqual([story("b"), story("a")]);
    expect(withRecentPage([story("a")], { kind: "component", id: "a" })).toEqual([
      { kind: "component", id: "a" },
      story("a")
    ]);
  });

  it("keeps the eight newest", () => {
    const pages = ["1", "2", "3", "4", "5", "6", "7", "8"].map(story);
    expect(withRecentPage(pages, story("new")).map((page) => page.id)).toEqual([
      "new",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7"
    ]);
  });
});
