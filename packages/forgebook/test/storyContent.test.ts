// @vitest-environment happy-dom
/**
 * Tests for how a story run waits for what its framework says the story loads, on a framework written here: the play
 * after the wait, the wait again after the play, a story meant to stay, a framework with nothing to say, an error during
 * the wait.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { heldFrameClock } from "../src/frame/frameClock.ts";
import {
  type ContentState,
  contentSettled,
  type FrameRenderer,
  type MountedStory,
  type StoryDrawing
} from "../src/frame/renderer.ts";
import type { StoryOutcome } from "../src/frame/storyContent.ts";
import { type LoadedStory, readStory } from "../src/frame/storyModule.ts";
import { runStory, type StoryControls } from "../src/frame/storyRun.ts";
import type { PanelArgs } from "../src/messages.ts";

/** What the frame saw happen, in order. */
type Line = string;

/**
 * A story from a story's fields, as the frame reads it.
 *
 * @param fields - the story.
 */
const storyOf = (fields: Record<string, unknown>): LoadedStory => {
  const read = readStory(
    { default: { title: "Kit/Late" }, Shown: { render: (): null => null, ...fields } },
    "Shown"
  );
  if (typeof read === "string") throw new Error(read);
  return read;
};

/**
 * Runs a story on a framework whose wait answers from a list, one answer per call.
 *
 * @param fields - the story.
 * @param answers - the wait's answers; none for a framework with nothing to say.
 * @param fail - what the framework's `onError` is handed during the first wait, if anything.
 * @returns what happened, and how it ended.
 */
const run = async (
  fields: Record<string, unknown>,
  answers: readonly ContentState[] | undefined,
  fail?: Error
): Promise<{
  readonly lines: readonly Line[];
  readonly timeouts: readonly number[];
  readonly outcome: StoryOutcome;
}> => {
  const lines: Line[] = [];
  const timeouts: number[] = [];
  const left = [...(answers ?? [])];
  const renderer: FrameRenderer = {
    mount: (_canvas: HTMLElement, _drawing: StoryDrawing, onError: (error: Error) => void): MountedStory => ({
      drawn: Promise.resolve(),
      ...(answers === undefined
        ? {}
        : {
            settled: async (timeout: number): Promise<ContentState> => {
              lines.push("wait");
              timeouts.push(timeout);
              if (fail !== undefined) onError(fail);
              return left.shift() ?? { state: "settled" };
            }
          }),
      update: (): undefined => undefined,
      unmount: (): undefined => undefined
    })
  };
  const outcome = await new Promise<StoryOutcome>((resolve) => {
    const container = document.createElement("div");
    document.body.append(container);
    runStory({
      container,
      story: storyOf({
        play: (): void => {
          lines.push("play");
        },
        ...fields
      }),
      identity: { id: "kit-late--shown", name: "Shown", title: "Kit/Late" },
      pluginSetups: [],
      renderer,
      clock: heldFrameClock(0),
      texts: {},
      decorators: [],
      globals: {},
      resolveArgs: (args: PanelArgs): PanelArgs => args,
      onControlsReady: (_controls: StoryControls, ended: StoryOutcome): void => resolve(ended),
      onEvent: () => undefined,
      panelArgsOf: () => ({}),
      onArgsChange: () => undefined,
      onError: () => undefined,
      onTrace: () => undefined
    });
  });
  return { lines, timeouts, outcome };
};

describe("the frame's wait for what a story loads", () => {
  it("plays once what the story loads came, and looks again after the play", async () => {
    const { lines, outcome } = await run({}, []);
    expect(lines).toEqual(["wait", "play", "wait"]);
    expect(outcome).toEqual({ status: "ready" });
  });

  it("does not wait twice for a story with no play", async () => {
    const { lines } = await run({ play: undefined }, []);
    expect(lines).toEqual(["wait"]);
  });

  it("takes the story's bound", async () => {
    const { timeouts } = await run({ parameters: { suspense: { timeout: 250 } } }, []);
    expect(timeouts[0]).toBeLessThanOrEqual(250);
    expect(timeouts[0]).toBeGreaterThan(200);
  });

  it.each([{ timeout: 0 }, { timeout: -1 }, { timeout: "soon" }, { timeout: Number.POSITIVE_INFINITY }, "x"])(
    "keeps the default for a bound that is none: %j",
    async (suspense) => {
      const { timeouts } = await run({ parameters: { suspense } }, []);
      expect(timeouts[0]).toBeGreaterThan(9000);
    }
  );

  it("gives up without the play, and says so as pending", async () => {
    const { lines, outcome } = await run({}, [{ state: "waiting", reason: "1 boundary shows its fallback" }]);
    expect(lines).toEqual(["wait"]);
    expect(outcome.status).toBe("pending");
    expect(outcome).toMatchObject({
      reason: expect.stringMatching(/^1 boundary shows its fallback after 10000 ms\..*suspense\.expected/)
    });
  });

  it("says pending for what the play's own click still loads", async () => {
    const { lines, outcome } = await run({}, [
      { state: "settled" },
      { state: "waiting", reason: "the tab it opened" }
    ]);
    expect(lines).toEqual(["wait", "play", "wait"]);
    expect(outcome).toMatchObject({
      status: "pending",
      reason: expect.stringContaining("the tab it opened")
    });
  });

  it("is pending when the framework cannot tell, and still plays", async () => {
    const { lines, outcome } = await run({}, [{ state: "unknown", reason: "cannot read it" }]);
    expect(lines).toEqual(["wait", "play"]);
    expect(outcome).toEqual({ status: "pending", reason: "cannot read it" });
  });

  it("does not wait for a story meant to stay in its fallback, whose play may read it", async () => {
    const { lines, outcome } = await run({ parameters: { suspense: { expected: true } } }, [
      { state: "waiting", reason: "never asked" }
    ]);
    expect(lines).toEqual(["play"]);
    expect(outcome).toEqual({ status: "ready" });
  });

  it("is ready once drawn on a framework with nothing to say", async () => {
    const { lines, outcome } = await run({}, undefined);
    expect(lines).toEqual(["play"]);
    expect(outcome).toEqual({ status: "ready" });
  });

  it("reads a wait that failed as not knowing, never as settled", async () => {
    const lines: string[] = [];
    const renderer: FrameRenderer = {
      mount: (): MountedStory => ({
        drawn: Promise.resolve(),
        settled: (): Promise<ContentState> => {
          lines.push("wait");
          return Promise.reject(new Error("Moved"));
        },
        update: (): undefined => undefined,
        unmount: (): undefined => undefined
      })
    };
    const outcome = await new Promise<StoryOutcome>((resolve) => {
      runStory({
        container: document.createElement("div"),
        story: storyOf({}),
        identity: { id: "kit-late--shown", name: "Shown", title: "Kit/Late" },
        pluginSetups: [],
        renderer,
        clock: heldFrameClock(0),
        texts: {},
        decorators: [],
        globals: {},
        resolveArgs: (args: PanelArgs): PanelArgs => args,
        onControlsReady: (_controls: StoryControls, ended: StoryOutcome): void => resolve(ended),
        onEvent: () => undefined,
        panelArgsOf: () => ({}),
        onArgsChange: () => undefined,
        onError: () => undefined,
        onTrace: () => undefined
      });
    });
    expect(outcome).toEqual({ status: "pending", reason: "Moved" });
    expect(lines).toEqual(["wait"]);
  });

  it("ends a first drawing that never comes as pending, for a framework with a wait", async () => {
    const renderer: FrameRenderer = {
      mount: (): MountedStory => ({
        drawn: new Promise(() => undefined),
        settled: () => Promise.resolve({ state: "settled" }),
        update: (): undefined => undefined,
        unmount: (): undefined => undefined
      })
    };
    const outcome = await new Promise<StoryOutcome>((resolve) => {
      runStory({
        container: document.createElement("div"),
        story: storyOf({ parameters: { suspense: { timeout: 20 } } }),
        identity: { id: "kit-late--shown", name: "Shown", title: "Kit/Late" },
        pluginSetups: [],
        renderer,
        clock: heldFrameClock(0),
        texts: {},
        decorators: [],
        globals: {},
        resolveArgs: (args: PanelArgs): PanelArgs => args,
        onControlsReady: (_controls: StoryControls, ended: StoryOutcome): void => resolve(ended),
        onEvent: () => undefined,
        panelArgsOf: () => ({}),
        onArgsChange: () => undefined,
        onError: () => undefined,
        onTrace: () => undefined
      });
    });
    expect(outcome).toMatchObject({ status: "pending", reason: expect.stringContaining("first drawing") });
  });

  it("keeps an error that came during the wait, without playing on it", async () => {
    const { lines, outcome } = await run({}, [], new Error("The lazy module failed"));
    expect(lines).toEqual(["wait"]);
    expect(outcome).toEqual({ status: "error" });
  });
});

describe("contentSettled", () => {
  it("answers at the first look when nothing waits, without a timer", async () => {
    let looks = 0;
    const answer = contentSettled(() => {
      looks += 1;
      return { state: "settled" };
    }, 1000);
    expect(looks).toBe(1);
    expect(await answer).toEqual({ state: "settled" });
  });

  it("looks again until it settles", async () => {
    let looks = 0;
    const answer = await contentSettled(() => {
      looks += 1;
      return looks < 4 ? { state: "waiting", reason: "r" } : { state: "settled" };
    }, 5000);
    expect(answer).toEqual({ state: "settled" });
    expect(looks).toBe(4);
  });

  it("stops at the bound with what still waits, and at once on what it cannot tell", async () => {
    expect(await contentSettled(() => ({ state: "waiting", reason: "r" }), 10)).toEqual({
      state: "waiting",
      reason: "r"
    });
    let looks = 0;
    await contentSettled(() => {
      looks += 1;
      return { state: "unknown", reason: "r" };
    }, 5000);
    expect(looks).toBe(1);
  });
});
