/**
 * Svelte's server render beyond the adapter suite, in Node where the components are compiled for the server: snippets,
 * decorators and what a story's components read, drawn as HTML.
 *
 * @module
 */
import { heldStoryClock } from "@forgebook/story-format/clock";
import type { StoryDrawing } from "forgebook/renderer";
import { readStory } from "forgebook/story-module";
import { describe, expect, it } from "vitest";

import { svelteRenderer } from "../src/svelteRenderer.ts";
import Card from "./components/Card.svelte";
import Reader from "./components/Reader.svelte";
import Section from "./components/Section.svelte";

/** A drawing of a story with the meta's component. */
const drawing = (component: unknown, args: Readonly<Record<string, unknown>>): StoryDrawing => {
  const loaded = readStory({ default: { title: "Kit/Thing", component }, Plain: {} }, "Plain");
  if (typeof loaded === "string") throw new Error(loaded);
  return {
    identity: { id: "kit:kit-thing--plain", name: "Plain", title: "Kit/Thing" },
    story: loaded,
    args,
    texts: {},
    clock: heldStoryClock(0),
    decorators: [],
    globals: {},
    loaded: {}
  };
};

describe("Svelte's server render", () => {
  it("draws snippets from `#name` texts, escaped", async () => {
    const html = await svelteRenderer.renderToString(
      drawing(Card, { title: "T", "#header": "<i>", "#children": "Body" })
    );
    expect(html).toContain("<header><span>&lt;i&gt;</span>");
    expect(html).toContain("<main><span>Body</span>");
  });

  it("draws the story inside the catalogue's decorators", async () => {
    const plain = drawing(Card, { title: "T" });
    const html = await svelteRenderer.renderToString({
      ...plain,
      decorators: [() => ({ Component: Section, props: { label: "catalogue" } })]
    });
    expect(html).toMatch(/<section data-decorator="catalogue">[\s\S]*<h1>T<\/h1>/);
  });

  it("hands the story's components the texts and the clock", async () => {
    const html = await svelteRenderer.renderToString({
      ...drawing(Reader, {}),
      texts: { "greeting.hello": "Hello" },
      clock: heldStoryClock(42)
    });
    expect(html).toContain("Hello 42");
  });
});
