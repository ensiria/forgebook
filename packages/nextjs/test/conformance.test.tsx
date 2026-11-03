/**
 * The Next.js renderer passing the adapter suite: what it adds to React's (a route, server components) must not change
 * what every adapter does.
 *
 * @module
 */
import { join } from "node:path";

import { codeOf } from "@forgebook/react/code";
import { heldStoryClock } from "@forgebook/story-format/clock";
import { describeAdapter, THROWING_NAME } from "@forgebook/testing/conformance";
import type { StoryDrawing } from "forgebook/renderer";
import { readStory } from "forgebook/story-module";
import { type ReactNode, useState } from "react";

import { nextRenderer } from "../src/nextRenderer.tsx";
import { extractStoryComponent } from "../src/vite/extractDocs.ts";

/** The subject's story: a greeting with a counter of its own. */
const Greeting = ({ name }: { readonly name?: unknown }): ReactNode => {
  const [clicks, setClicks] = useState(0);
  if (name === THROWING_NAME) throw new Error("No greeting");
  return (
    <button type="button" onClick={(): void => setClicks(clicks + 1)}>
      Hello {String(name)} {clicks}
    </button>
  );
};

/**
 * A drawing of the greeting.
 *
 * @param name - its name.
 */
const drawing = (name: string): StoryDrawing => {
  const story = readStory(
    {
      default: { title: "Kit/Greeting" },
      Plain: { render: (args: { readonly name?: unknown }) => <Greeting name={args.name} /> }
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

describeAdapter({
  name: "Next.js",
  renderer: nextRenderer,
  drawing,
  codeOf,
  docsOf: () => {
    const read = extractStoryComponent(
      join(import.meta.dirname, "..", "..", "..", "fixtures", "nextjs", "components", "Hero.stories.tsx")
    );
    if (typeof read === "string") throw new Error(read);
    return read.docs;
  }
});
