/**
 * Tests for the plugins' frame modules in a frame: what reaches the shell, and what they run around a story.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { startPluginFrames } from "../src/frame/pluginFrames.ts";
import type { LoadedDecorator } from "../src/frame/storyModule.ts";
import type { FrameMessage } from "../src/messages.ts";
import { definePluginFrame, type JsonValue, type PluginFrameHost } from "../src/plugin.ts";

describe("startPluginFrames", () => {
  it("adds nothing for a catalogue with none", () => {
    const frames = startPluginFrames(
      [],
      "a",
      () => undefined,
      () => undefined
    );
    expect(frames).toMatchObject({ decorators: [], setups: [] });
    expect(() => frames.receive("acme", 1)).not.toThrow();
  });

  it("names a report with its story and its plugin", () => {
    const told: FrameMessage[] = [];
    const create = definePluginFrame(({ report }: PluginFrameHost) => {
      report({ count: 1 }, { hint: "1", tab: "acme-log" });
      report("again");
      return {};
    });
    startPluginFrames(
      [{ id: "acme", create }],
      "kit:a",
      (message) => told.push(message),
      () => undefined
    );
    expect(told).toEqual([
      {
        type: "forgebook:plugin",
        storyId: "kit:a",
        plugin: "acme",
        value: { count: 1 },
        hint: "1",
        tab: "acme-log"
      },
      { type: "forgebook:plugin", storyId: "kit:a", plugin: "acme", value: "again", hint: null, tab: null }
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
      () => undefined,
      () => undefined
    );
    expect(frames.decorators).toEqual([decorator]);
    expect(frames.setups).toEqual([prepare]);
  });

  it("hands what a tab sends to its own plugin's frame module only, which answers with a report", () => {
    const told: FrameMessage[] = [];
    const got: unknown[] = [];
    const acme = definePluginFrame(({ report }: PluginFrameHost) => ({
      receive: (value: JsonValue): void => {
        got.push(value);
        report({ echoed: value });
      }
    }));
    const other = definePluginFrame(() => ({
      receive: (value: JsonValue): void => void got.push(["other", value])
    }));
    const frames = startPluginFrames(
      [
        { id: "acme", create: acme },
        { id: "other", create: other },
        { id: "quiet", create: () => ({}) }
      ],
      "kit:a",
      (message) => told.push(message),
      () => undefined
    );
    expect(
      frames.take({ type: "forgebook:plugin-message", plugin: "acme", value: { highlight: true } })
    ).toBe(true);
    expect(frames.take({ type: "forgebook:replay" })).toBe(false);
    frames.receive("quiet", 1);
    frames.receive("missing", 2);
    expect(got).toEqual([{ highlight: true }]);
    expect(told).toEqual([
      {
        type: "forgebook:plugin",
        storyId: "kit:a",
        plugin: "acme",
        value: { echoed: { highlight: true } },
        hint: null,
        tab: null
      }
    ]);
  });

  it("reports what a frame module's receive throws, and keeps receiving", () => {
    const errors: unknown[] = [];
    let count = 0;
    const create = definePluginFrame(() => ({
      receive: (): void => {
        count += 1;
        if (count === 1) throw new Error("Broke on the first");
      }
    }));
    const frames = startPluginFrames(
      [{ id: "acme", create }],
      "kit:a",
      () => undefined,
      (error) => errors.push(error)
    );
    frames.receive("acme", 1);
    frames.receive("acme", 2);
    expect(errors).toEqual([new Error("Broke on the first")]);
    expect(count).toBe(2);
  });
});
