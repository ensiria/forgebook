/**
 * Tests for a story's code as `forgebook story` gives it to an agent.
 *
 * @module
 */
import type { StorySource } from "@forgebook/story-format/source";
import { describe, expect, it } from "vitest";

import { jsxCode } from "../src/jsxCode.ts";
import { findStory, storyTree } from "../src/storyTree.ts";
import { storyDocument } from "../src/vite/agentApi.ts";
import { type AgentCodeParts, agentStoryCode, withStoryCode } from "../src/vite/agentStoryCode.ts";

/** A source with one story file of a button. */
const SOURCE: StorySource = {
  id: "kit",
  name: "Kit",
  files: [
    {
      index: { "./button.stories.tsx": { title: "Actions/Button", stories: [{ exportName: "Primary" }] } },
      stories: {},
      docs: {},
      code: {},
      pages: {}
    }
  ],
  sheets: { required: [], theme: [], restyled: [] }
};

const location = findStory(storyTree([SOURCE]), "kit:actions-button--primary");

/** The story file's module once it ran. */
const MODULE = {
  default: { title: "Actions/Button", args: { size: "md", onClick: (): void => undefined } },
  Primary: { args: { label: "Save" } }
};

/** The file's code and the React writer. */
const PARTS: AgentCodeParts = {
  code: { value: { Primary: { args: { onClick: "fn()" } } } },
  writer: jsxCode,
  namedValues: undefined
};

describe("agentStoryCode", () => {
  if (location === undefined) throw new Error("the fixture's story is missing");
  const story = { location, module: MODULE, preview: undefined, accepted: undefined, docs: undefined };

  it("writes the story's values with the args its file writes as code, under its component's name", () => {
    expect(agentStoryCode(PARTS, story)).toBe('<Button size="md" label="Save" onClick={fn()} />');
  });

  it("writes a value an agent set from that value", () => {
    expect(agentStoryCode(PARTS, { ...story, accepted: { label: "Sent" } })).toBe(
      '<Button size="md" label="Sent" onClick={fn()} />'
    );
  });

  it("gives nothing without a writer, without the file's code, or without the story's module", () => {
    expect(agentStoryCode({ ...PARTS, writer: undefined }, story)).toBeUndefined();
    expect(agentStoryCode({ ...PARTS, code: { error: "no" } }, story)).toBeUndefined();
    expect(agentStoryCode(PARTS, { ...story, module: {} })).toBeUndefined();
  });

  it("adds the code to the story's answer, and leaves the answer as it is without one", () => {
    const pages = { page: "http://localhost:5173/", frame: "http://localhost:5173/frame.html" };
    const document = storyDocument(
      location,
      { module: { value: MODULE }, docs: { value: { name: null } } },
      pages,
      ""
    );
    expect(withStoryCode(document, PARTS, story).code).toBe(
      '<Button size="md" label="Save" onClick={fn()} />'
    );
    expect(withStoryCode(document, undefined, story)).toBe(document);
  });
});
