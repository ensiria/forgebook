/**
 * Tests for a picture's file name: the story's id and the view's name, kept to letters, digits and hyphens, the
 * default view named so.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { shotName } from "../src/shotStories.ts";

describe("shotName", () => {
  it("names a picture by its story and its view, safe for any file system", () => {
    expect(shotName({ story: { id: "kit:data-badge--default" }, name: "theme=dark&width=360" })).toBe(
      "kit-data-badge--default--theme-dark-width-360.png"
    );
    expect(shotName({ story: { id: "kit:data-badge--default" }, name: "" })).toBe(
      "kit-data-badge--default--default.png"
    );
  });
});
