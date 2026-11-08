/**
 * Tests for how a console error reads as a problem: a file the page could not load is named by its path.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { consoleErrorText } from "../src/storyCheck.ts";

/** Chromium's text for an image the server answered 404. */
const NOT_FOUND = "Failed to load resource: the server responded with a status of 404 (Not Found)";

describe("consoleErrorText", () => {
  it("names the file a page could not load by its path, without the run's origin", () => {
    expect(consoleErrorText(NOT_FOUND, "http://localhost:6482/avatars/shadcn.jpg?size=2")).toBe(
      `${NOT_FOUND}: /avatars/shadcn.jpg?size=2`
    );
  });

  it("keeps any other error as the console wrote it, wherever it was logged", () => {
    expect(consoleErrorText("Warning: Each child needs a key", "http://localhost:6482/src/List.tsx")).toBe(
      "Warning: Each child needs a key"
    );
  });

  it("keeps the text alone when the console gives no address", () => {
    expect(consoleErrorText(NOT_FOUND, "")).toBe(NOT_FOUND);
  });
});
