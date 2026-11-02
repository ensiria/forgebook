/**
 * Tests for the plugins' frame modules in a frame: what reaches the shell, and what they run around a story.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { startPluginFrames } from "../src/frame/pluginFrames.ts";
import type { LoadedDecorator } from "../src/frame/storyModule.ts";
import type { FrameMessage } from "../src/messages.ts";
import { definePluginFrame, type PluginFrameHost } from "../src/plugin.ts";

describe("startPluginFrames", () => {
  it("adds nothing for a catalogue with none", () => {
    expect(startPluginFrames([], "a", () => undefined)).toEqual({ decorators: [], setups: [] });
  });

  it("names a report with its story and its plugin", () => {
    const told: FrameMessage[] = [];
    const create = definePluginFrame(({ report }: PluginFrameHost) => {
      report({ count: 1 }, "1");
      report("again");
      return {};
    });
    startPluginFrames([{ id: "acme", create }], "kit:a", (message) => told.push(message));
    expect(told).toEqual([
      { type: "forgebook:plugin", storyId: "kit:a", plugin: "acme", value: { count: 1 }, hint: "1" },
      { type: "forgebook:plugin", storyId: "kit:a", plugin: "acme", value: "again", hint: null }
    ]);
  });

  it("gathers decorators and preparations in the order of the plugins", () => {
    const decorator: LoadedDecorator = (story: () => unknown): unknown => story();
    const prepare = (): undefined => undefined;
    const frames = startPluginFrames(
      [
        { id: "a", create: () => ({ decorators: [decorator] }) },
        { id: "b", create: () => ({ prepare }) }
      ],
      "s",
      () => undefined
    );
    expect(frames.decorators).toEqual([decorator]);
    expect(frames.setups).toEqual([prepare]);
  });

  it("tells a frame module which contract it speaks", () => {
    let version: number | undefined;
    const create = definePluginFrame(({ apiVersion }: PluginFrameHost) => {
      version = apiVersion;
      return {};
    });
    startPluginFrames([{ id: "acme", create }], "s", () => undefined);
    expect(version).toBe(1);
  });
});
