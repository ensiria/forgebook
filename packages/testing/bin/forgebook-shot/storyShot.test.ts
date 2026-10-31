/**
 * Tests for `forgebook-shot`'s address: the frame page of a story, with only what the frame reads of the view.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { shotAddress } from "./storyShot.ts";

describe("shotAddress", () => {
  it("opens the catalogue's frame page with the story and the view", () => {
    expect(
      shotAddress("http://localhost:5310/", "acme-ui:feedback-counter--plain", "theme=dark&lang=it")
    ).toBe("http://localhost:5310/frame.html?theme=dark&lang=it&story=acme-ui%3Afeedback-counter--plain");
  });

  it("leaves out what only the shell reads, and takes a catalogue address without its final slash", () => {
    expect(shotAddress("http://localhost:5310", "kit:a--b", "width=560&tab=code&compare=theme")).toBe(
      "http://localhost:5310/frame.html?story=kit%3Aa--b"
    );
  });
});
