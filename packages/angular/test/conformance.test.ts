/**
 * Angular passing the adapter suite: the definition of done every framework adapter meets.
 *
 * @module
 */
import { join } from "node:path";

import { heldStoryClock } from "@forgebook/story-format/clock";
import { describeAdapter } from "@forgebook/testing/conformance";
import type { StoryDrawing } from "forgebook/renderer";
import { type LoadedDecorator, readStory } from "forgebook/story-module";

import { angularRenderer } from "../src/angularRenderer.ts";
import { codeOf } from "../src/storyTemplate.ts";
import { extractComponentDocs } from "../src/vite/extractDocs.ts";
import { Greeting } from "./subjects/Greeting.ts";

/** A drawing of the greeting, drawn from its args. */
const drawing = (name: string): StoryDrawing => {
  const story = readStory({ default: { title: "Kit/Greeting", component: Greeting }, Plain: {} }, "Plain");
  if (typeof story === "string") throw new Error(story);
  return {
    identity: { id: "kit:kit-greeting--plain", name: "Plain", title: "Kit/Greeting" },
    story,
    args: { name },
    texts: {},
    clock: heldStoryClock(0),
    decorators: [],
    globals: {},
    loaded: {}
  };
};

/** Whether a value is a plain object, as a decorator's `story()` gives one. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

/** A decorator as Angular's stories write one: markup around the story's template. */
const decorator =
  (label: string): LoadedDecorator =>
  (story: () => unknown): Readonly<Record<string, unknown>> => {
    const inner = story();
    const result = isRecord(inner) ? inner : {};
    const template = typeof result["template"] === "string" ? result["template"] : "";
    return { ...result, template: `<section data-decorator="${label}">${template}</section>` };
  };

describeAdapter({
  name: "Angular",
  renderer: angularRenderer,
  drawing,
  decorator,
  codeOf,
  docsOf: () =>
    extractComponentDocs(join(import.meta.dirname, "..", "fixtures", "docs", "src", "Badge.stories.ts"))
});
