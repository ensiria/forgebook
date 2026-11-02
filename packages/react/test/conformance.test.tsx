/**
 * React passing the adapter suite: the definition of done every framework adapter meets.
 *
 * @module
 */

import { join } from "node:path";

import { heldStoryClock } from "@forgebook/story-format/clock";
import { describeAdapter, THROWING_NAME } from "@forgebook/testing/conformance";
import type { StoryDrawing } from "forgebook/renderer";
import { readStory } from "forgebook/story-module";
import { type ReactNode, useState } from "react";

import { reactRenderer } from "../src/reactRenderer.tsx";
import { codeOf } from "../src/storyJsx.ts";
import { extractComponentDocs } from "../src/vite/extractDocs.ts";
import { KIT_DIR } from "./fixturePaths.ts";

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

/** A drawing of the greeting. */
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
  name: "React",
  renderer: reactRenderer,
  drawing,
  codeOf,
  docsOf: () => extractComponentDocs(join(KIT_DIR, "src", "Select.stories.tsx"))
});
