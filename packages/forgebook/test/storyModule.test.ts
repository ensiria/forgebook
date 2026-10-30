/**
 * Tests for a loaded story file read by the frame: CSF 3 objects, CSF 2 functions, the meta's render and play, and
 * any component the framework makes.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type LoadedStory, mergedPreviews, readPreview, readStory } from "../src/frame/storyModule";

/**
 * A story read from a module, failing the test when it cannot be read.
 *
 * @param module - the module's exports.
 * @param exportName - the story.
 */
const read = (module: Record<string, unknown>, exportName: string): LoadedStory => {
  const story = readStory(module, exportName);
  if (typeof story === "string") throw new Error(story);
  return story;
};

describe("readStory", () => {
  it("reads a CSF 2 function story: the function is its render, its properties its args and parameters", () => {
    const Primary = Object.assign((): string => "drawn", {
      args: { label: "Go" },
      parameters: { layout: "centered" },
      play: (): void => undefined
    });
    const story = read({ default: { title: "A/B", args: { size: "s" } }, Primary }, "Primary");
    expect(story.render).toBe(Primary);
    expect(story.args).toEqual({ size: "s", label: "Go" });
    expect(story.layout).toBe("centered");
    expect(story.play).toBe(Primary.play);
  });

  it("gives every story the meta's render and play, a story's own winning", () => {
    const metaRender = (): string => "meta";
    const metaPlay = (): void => undefined;
    const ownRender = (): string => "own";
    const module = {
      default: { title: "A/B", render: metaRender, play: metaPlay },
      Plain: {},
      Own: { render: ownRender }
    };
    expect(read(module, "Plain").render).toBe(metaRender);
    expect(read(module, "Plain").play).toBe(metaPlay);
    expect(read(module, "Own").render).toBe(ownRender);
  });

  it("passes on a component that is an object, as memo and forwardRef make, for the renderer to read", () => {
    // what a framework makes of a component, an object the core does not look into
    const memoized = { type: (): null => null };
    expect(read({ default: { title: "A/B", component: memoized }, X: {} }, "X").component).toBe(memoized);
    expect(read({ default: { title: "A/B" }, X: {} }, "X").component).toBeUndefined();
  });

  it("refuses an export that is neither an object nor a function", () => {
    expect(readStory({ default: { title: "A/B" }, X: "text" }, "X")).toBe('The story file has no story "X"');
  });
});

describe("a preview re-exported from Storybook", () => {
  it("gives every story its args and argTypes under the meta's and the story's", () => {
    const preview = mergedPreviews([
      readPreview({ args: { size: "md", tone: "neutral" }, argTypes: { tone: { control: "radio" } } }),
      readPreview({ default: { argTypes: { tone: { description: "From the second preview." } } } })
    ]);
    const story = readStory(
      { default: { title: "A/B", args: { tone: "danger" } }, X: { args: { label: "Go" } } },
      "X",
      preview
    );
    if (typeof story === "string") throw new Error(story);
    expect(story.args).toEqual({ size: "md", tone: "danger", label: "Go" });
    expect(story.argTypes).toEqual({ tone: { control: "radio", description: "From the second preview." } });
  });
});
