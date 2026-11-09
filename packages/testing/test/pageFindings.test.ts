/**
 * Tests for how a page's errors and missing files become problems and warnings: a missing static file is a warning
 * named by its path, any other error fails the story.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import {
  consoleErrorText,
  isMissingStaticFile,
  missingFileWarnings,
  type PageError,
  pageFindings
} from "../src/storyCheck.ts";

/** Chromium's text for a file the server answered 404. */
const NOT_FOUND = "Failed to load resource: the server responded with a status of 404 (Not Found)";

/** A missing image's console error, as the frame's origin names it. */
const AVATAR = "http://localhost:6482/avatars/shadcn.jpg";

describe("isMissingStaticFile", () => {
  it("takes an image, a font or a style sheet that answers 404", () => {
    expect(isMissingStaticFile("image", 404)).toBe(true);
    expect(isMissingStaticFile("font", 404)).toBe(true);
    expect(isMissingStaticFile("stylesheet", 404)).toBe(true);
  });

  it("leaves a script, a fetch and any other status to the errors", () => {
    expect(isMissingStaticFile("script", 404)).toBe(false);
    expect(isMissingStaticFile("fetch", 404)).toBe(false);
    expect(isMissingStaticFile("image", 500)).toBe(false);
  });
});

describe("pageFindings", () => {
  it("moves a missing image's console error to the warnings, by its path", () => {
    const errors: PageError[] = [{ source: "console", text: NOT_FOUND, location: AVATAR }];
    expect(pageFindings(errors, [AVATAR, AVATAR])).toEqual({
      errors: [],
      missingFiles: ["/avatars/shadcn.jpg"]
    });
  });

  it("keeps a module that answers 404, and page errors, as errors that name the file", () => {
    const errors: PageError[] = [
      { source: "console", text: NOT_FOUND, location: "http://localhost:6482/src/Gone.tsx" },
      { source: "page", text: "Cannot read properties of undefined", location: "" }
    ];
    expect(pageFindings(errors, [AVATAR]).errors).toEqual([
      `${NOT_FOUND}: /src/Gone.tsx`,
      "Cannot read properties of undefined"
    ]);
  });

  it("gives a result no warnings when no file is missing", () => {
    expect(missingFileWarnings(pageFindings([], []))).toEqual({});
    expect(missingFileWarnings(pageFindings([], [AVATAR])).warnings?.[0]).toMatchObject({
      kind: "missing-file",
      path: "/avatars/shadcn.jpg"
    });
  });
});

describe("consoleErrorText", () => {
  it("keeps any other error as the console wrote it, wherever it was logged", () => {
    expect(consoleErrorText("Warning: Each child needs a key", "http://localhost:6482/src/List.tsx")).toBe(
      "Warning: Each child needs a key"
    );
  });

  it("keeps the text alone when the console gives no address", () => {
    expect(consoleErrorText(NOT_FOUND, "")).toBe(NOT_FOUND);
  });
});
