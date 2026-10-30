/**
 * Tests for the controls rule: a story of fixed examples declares no controls, and only such a story does.
 *
 * @module
 */
import type { StoryContext } from "@forgebook/story-format/csf";
import type { LoadedArgs, LoadedStory } from "forgebook/story-module";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { storyControlsProblem } from "../src/storyControls";

/** A loaded story with a component, changed by `parts`. */
const story = (parts: Partial<LoadedStory>): LoadedStory => ({
  component: (): ReactNode => null,
  args: {},
  render: undefined,
  play: undefined,
  decorators: [],
  forceState: [],
  replay: undefined,
  controls: "all",
  layout: "padded",
  clockStart: undefined,
  ...parts
});

describe("storyControlsProblem", () => {
  it("accepts the component with its args, and a render that reads them", () => {
    expect(storyControlsProblem(story({}))).toBeUndefined();
    expect(
      storyControlsProblem(story({ render: (args: LoadedArgs): ReactNode => String(args["x"]) }))
    ).toBeUndefined();
    expect(
      storyControlsProblem(
        story({ render: (args: LoadedArgs): ReactNode => String(args["x"]), controls: ["x"] })
      )
    ).toBe(undefined);
  });

  it("asks a render without args to declare no controls, and accepts it when it does", () => {
    expect(storyControlsProblem(story({ render: (): ReactNode => null }))).toMatch(/controls: false/);
    expect(storyControlsProblem(story({ render: (): ReactNode => null, controls: [] }))).toBeUndefined();
  });

  it("takes a render whose first parameter is named unused as one without args, so it may read the context", () => {
    const render = (_args: LoadedArgs, { text }: StoryContext<LoadedArgs>): ReactNode => text("caption");
    expect(storyControlsProblem(story({ render }))).toMatch(/controls: false/);
    expect(storyControlsProblem(story({ render, controls: [] }))).toBeUndefined();
  });

  it("refuses no controls on a story whose args reach it", () => {
    expect(storyControlsProblem(story({ controls: [] }))).toMatch(/args reach the story/);
    expect(
      storyControlsProblem(
        story({ render: (args: LoadedArgs): ReactNode => String(args["x"]), controls: [] })
      )
    ).toMatch(/args reach the story/);
  });

  it("accepts no controls on a render that follows only the arg its Replay toggles", () => {
    const render = (args: LoadedArgs): ReactNode => String(args["hasData"]);
    expect(
      storyControlsProblem(story({ render, controls: [], replay: { toggle: "hasData" } }))
    ).toBeUndefined();
  });

  it("leaves pages without a component alone", () => {
    expect(
      storyControlsProblem(story({ component: undefined, render: (): ReactNode => null }))
    ).toBeUndefined();
  });
});
