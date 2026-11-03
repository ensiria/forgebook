/**
 * Svelte's subject of the adapter suite, shared by its two runs: in a simulated page, and in Node, where Svelte compiles
 * the components for the server.
 *
 * @module
 */
import { join } from "node:path";

import { heldStoryClock } from "@forgebook/story-format/clock";
import type { AdapterSubject } from "@forgebook/testing/conformance";
import type { StoryDrawing } from "forgebook/renderer";
import { type LoadedDecorator, readStory } from "forgebook/story-module";

import { codeOf } from "../src/storyMarkup.ts";
import { svelteRenderer } from "../src/svelteRenderer.ts";
import { extractComponentDocs } from "../src/vite/extractDocs.ts";
import Greeting from "./components/Greeting.svelte";
import Section from "./components/Section.svelte";

/** A drawing of the greeting. */
const drawing = (name: string): StoryDrawing => {
  const story = readStory(
    {
      default: { title: "Kit/Greeting" },
      Plain: {
        render: (args: { readonly name?: unknown }) => ({ Component: Greeting, props: { name: args.name } })
      }
    },
    "Plain"
  );
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

/** Svelte's subject, without the half a run checks. */
export const svelteSubject: Omit<AdapterSubject, "half"> = {
  name: "Svelte",
  renderer: svelteRenderer,
  drawing,
  decorator:
    (label: string): LoadedDecorator =>
    () => ({ Component: Section, props: { label } }),
  codeOf,
  docsOf: () => extractComponentDocs(join(import.meta.dirname, "fixtures", "docs", "src", "Badge.stories.ts"))
};
