/**
 * SvelteKit's subject of the adapter suite, shared by its two runs: Svelte's renderer wrapped with a story's page must
 * still do all the frame relies on, in a simulated page and in Node.
 *
 * @module
 */
import { heldStoryClock } from "@forgebook/story-format/clock";
import type { AdapterSubject } from "@forgebook/testing/conformance";
import type { StoryDrawing } from "forgebook/renderer";
import { type LoadedDecorator, readStory } from "forgebook/story-module";

import { kitRenderer } from "../src/kitRenderer.ts";
import { codeOf } from "../src/storyCode.ts";
import Greeting from "./components/Greeting.svelte";
import Section from "./components/Section.svelte";

/**
 * A drawing of the greeting, on a page of the app.
 *
 * @param name - the greeting's name.
 */
const drawing = (name: string): StoryDrawing => {
  const story = readStory(
    {
      default: { title: "Kit/Greeting", parameters: { sveltekit: { page: { url: "/greeting" } } } },
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

/** SvelteKit's subject, without the half a run checks. */
export const kitSubject: Omit<AdapterSubject, "half"> = {
  name: "SvelteKit",
  renderer: kitRenderer,
  drawing,
  decorator:
    (label: string): LoadedDecorator =>
    () => ({ Component: Section, props: { label } }),
  codeOf
};
