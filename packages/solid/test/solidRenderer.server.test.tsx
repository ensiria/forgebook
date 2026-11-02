/**
 * Tests for the Solid renderer on a server, with Solid's server build: the texts, the clock and the catalogue's
 * decorators reach the story, and the render waits for the resources it reads.
 *
 * @module
 */

import { heldStoryClock } from "@forgebook/story-format/clock";
import type { StoryContext } from "@forgebook/story-format/csf";
import type { StoryDrawing } from "forgebook/renderer";
import { type LoadedArgs, type LoadedStory, readPreview, readStory } from "forgebook/story-module";
import { createResource, type JSX } from "solid-js";
import { describe, expect, it } from "vitest";

import { useStoryNow } from "../src/clock.ts";
import { solidRenderer } from "../src/solidRenderer.ts";
import { useStoryText } from "../src/texts.ts";

/**
 * A drawing of a story.
 *
 * @param story - the story's export.
 * @param overrides - what differs from the default drawing.
 */
const drawing = (story: Record<string, unknown>, overrides: Partial<StoryDrawing> = {}): StoryDrawing => {
  const read: LoadedStory | string = readStory(
    { default: { title: "Kit/Greeting" }, Greeting: story },
    "Greeting"
  );
  if (typeof read === "string") throw new Error(read);
  return {
    identity: { id: "kit:kit-greeting--greeting", name: "Greeting", title: "Kit/Greeting" },
    story: read,
    args: { name: "Ada" },
    texts: { hello: "Ciao" },
    clock: heldStoryClock(1000),
    decorators: [],
    globals: { lang: "it" },
    loaded: {},
    ...overrides
  };
};

/**
 * A greeting in the shown language's text, at the story's moment.
 *
 * @param props - the name.
 */
const Greeting = (props: { readonly name?: unknown }): JSX.Element => {
  const text = useStoryText();
  const now = useStoryNow();
  return (
    <p>
      {text("hello")} {String(props.name)} {now()}
    </p>
  );
};

describe("solidRenderer on a server", () => {
  it("draws a story with its texts and clock, inside the catalogue's decorators, which read its globals", async () => {
    const inLanguage = (story: () => JSX.Element, context: StoryContext<LoadedArgs>): JSX.Element => (
      <div lang={context.globals["lang"]}>{story()}</div>
    );
    const html = await solidRenderer.renderToString(
      drawing(
        { render: (args: { readonly name?: unknown }) => <Greeting name={args.name} /> },
        { decorators: readPreview({ decorators: [inLanguage] }).decorators }
      )
    );
    // `data-hk` and the comments are Solid's hydration marks, written by a server build that can hydrate
    expect(html.replace(/<!--[^>]*-->| data-hk="\d+"/g, "")).toBe(
      '<div lang="it"><p>Ciao Ada 1000</p></div>'
    );
  });

  it("waits for the resources a story reads", async () => {
    const Loaded = (): JSX.Element => {
      const [value] = createResource(
        () => new Promise<string>((resolve) => setTimeout(() => resolve("Loaded"), 10))
      );
      return <i>{value()}</i>;
    };
    expect(await solidRenderer.renderToString(drawing({ render: () => <Loaded /> }))).toContain("Loaded");
  });
});
