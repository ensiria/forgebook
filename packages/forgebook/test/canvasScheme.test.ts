/**
 * Tests for reading the colour scheme a frame's document draws in from its canvas colour.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { schemeOfCanvas } from "../src/frame/canvasScheme.ts";

describe("schemeOfCanvas", () => {
  it("reads the canvases browsers use", () => {
    expect(schemeOfCanvas("rgb(255, 255, 255)")).toBe("light");
    expect(schemeOfCanvas("rgb(18, 18, 18)")).toBe("dark");
    expect(schemeOfCanvas("rgb(28, 27, 34)")).toBe("dark");
  });

  it("reads a canvas written in another form", () => {
    expect(schemeOfCanvas("color(srgb 0.1 0.1 0.1)")).toBe("dark");
  });

  it("takes what is not a colour as a document that declares no scheme", () => {
    expect(schemeOfCanvas("")).toBe("light");
  });
});
