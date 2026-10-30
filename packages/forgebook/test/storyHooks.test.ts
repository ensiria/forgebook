/**
 * Tests for what runs before a story is drawn: its loaders and set-ups, in CSF's order, and their cleanups.
 *
 * @module
 */
import type { StoryHookContext } from "@forgebook/story-format/csf";
import { describe, expect, it } from "vitest";

import { heldFrameClock } from "../src/frame/frameClock";
import { prepareStory } from "../src/frame/storyHooks";
import { type LoadedArgs, readPreview, readStory } from "../src/frame/storyModule";

/** What a loader and a set-up receive here. */
const CONTEXT = {
  args: { label: "New" },
  text: (key: string): string => key,
  clock: heldFrameClock(0),
  globals: {},
  id: "kit:a-b--x",
  name: "X",
  title: "A/B",
  parameters: {}
};

describe("prepareStory", () => {
  it("merges the loaders' results, the story's over the meta's over the preview's", async () => {
    const preview = readPreview({
      loaders: [(): Record<string, unknown> => ({ user: "preview", theme: "light" })]
    });
    const story = readStory(
      {
        default: { title: "A/B", loaders: (): Record<string, unknown> => ({ user: "meta", rows: 3 }) },
        X: { loaders: [async (): Promise<Record<string, unknown>> => ({ user: "story" })] }
      },
      "X",
      preview
    );
    if (typeof story === "string") throw new Error(story);
    const prepared = await prepareStory(story, CONTEXT);
    expect(prepared.loaded).toEqual({ user: "story", theme: "light", rows: 3 });
  });

  it("runs the set-ups in order after the loaders, and their cleanups the last first", async () => {
    const events: string[] = [];
    const prepared = await prepareStory(
      {
        loaders: [(): Record<string, unknown> => ({ value: 1 })],
        beforeEach: [
          (context: StoryHookContext<LoadedArgs>): (() => void) => {
            events.push(`first sees ${String(context.loaded["value"])}`);
            return (): void => {
              events.push("first undone");
            };
          },
          async (): Promise<() => void> => {
            events.push("second");
            return (): void => {
              events.push("second undone");
            };
          },
          (): undefined => {
            events.push("third, nothing to undo");
            return undefined;
          }
        ]
      },
      CONTEXT
    );
    await prepared.cleanup();
    expect(events).toEqual([
      "first sees 1",
      "second",
      "third, nothing to undo",
      "second undone",
      "first undone"
    ]);
  });

  it("undoes the set-ups that ran when a later one throws, then throws", async () => {
    const events: string[] = [];
    const preparing = prepareStory(
      {
        loaders: [],
        beforeEach: [
          (): (() => void) => (): void => {
            events.push("undone");
          },
          (): undefined => {
            throw new Error("No mock server");
          }
        ]
      },
      CONTEXT
    );
    await expect(preparing).rejects.toThrow("No mock server");
    expect(events).toEqual(["undone"]);
  });
});
