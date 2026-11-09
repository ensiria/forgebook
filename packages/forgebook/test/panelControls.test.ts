/**
 * Tests for when a frame loads its custom controls' turning code and its story's docs: only when a module may have
 * something to do for the story.
 *
 * @module
 */
import type { StorySource } from "@forgebook/story-format/source";
import { describe, expect, it } from "vitest";

import { panelControls } from "../src/frame/panelControls.ts";
import type { PanelArgs } from "../src/messages.ts";

/** A source whose one story file's docs loader counts its loads. */
const sourceCounting = (): { readonly source: StorySource; readonly loads: () => number } => {
  let count = 0;
  const docs = async (): Promise<unknown> => {
    count += 1;
    return { name: "Chip", props: [] };
  };
  const files = { index: {}, stories: {}, docs: { "./Chip.stories.tsx": docs }, code: {}, pages: {} };
  return {
    source: { id: "kit", name: "Kit", files: [files], sheets: { required: [], theme: [], restyled: [] } },
    loads: () => count
  };
};

/** The drawn story's controls, keeping the values they were given. */
const controlsKeeping = (given: PanelArgs[]): { readonly setPanelArgs: (args: PanelArgs) => void } => ({
  setPanelArgs: (args: PanelArgs): void => {
    given.push(args);
  }
});

/** Waits for the frame's queued work. */
const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

describe("panelControls", () => {
  const loaders = {
    icon: async (): Promise<unknown> => ({ toStoryValue: (value: unknown): unknown => value })
  };

  it("loads no docs for a story whose values are plain and to which the panel gives none", async () => {
    const { source, loads } = sourceCounting();
    const given: PanelArgs[] = [];
    const typed = panelControls(loaders, source, "./Chip.stories.tsx", () => undefined);
    const story = { args: { label: "Go", onPress: (): void => undefined }, argTypes: {} };
    const ready = { story, controls: controlsKeeping(given), tellReady: (): void => undefined };
    typed.take({ type: "forgebook:args", args: {} }, ready, () => undefined);
    await settled();
    expect(given).toEqual([{}]);
    expect(loads()).toBe(0);
  });

  it("answers the shell's other messages after the values before them, in order", async () => {
    const { source } = sourceCounting();
    const order: string[] = [];
    const typed = panelControls(loaders, source, "./Chip.stories.tsx", () => undefined);
    const ready = {
      story: { args: {}, argTypes: {} },
      controls: { setPanelArgs: (): void => void order.push("args") },
      tellReady: (): void => undefined
    };
    typed.take({ type: "forgebook:args", args: {} }, ready, () => undefined);
    typed.take({ type: "forgebook:replay" }, ready, () => void order.push("replay"));
    await settled();
    expect(order).toEqual(["args", "replay"]);
  });

  it("hands every message on at once without frame modules", () => {
    const { source, loads } = sourceCounting();
    const given: PanelArgs[] = [];
    const typed = panelControls(undefined, source, "./Chip.stories.tsx", () => undefined);
    const ready = {
      story: { args: {}, argTypes: {} },
      controls: controlsKeeping(given),
      tellReady: (): void => undefined
    };
    typed.take({ type: "forgebook:args", args: { label: "Go" } }, ready, () => undefined);
    expect(given).toEqual([{ label: "Go" }]);
    expect(loads()).toBe(0);
  });
});
