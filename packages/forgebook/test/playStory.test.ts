/**
 * Tests for playStory: the frame hears the play is over only after it finished, at once without a play, and after a
 * play that failed, whose failure still reaches the caller.
 *
 * @module
 */
import { heldStoryClock } from "@forgebook/story-format/clock";
import { describe, expect, it } from "vitest";

import { runPlay } from "../src/frame/playStepper.ts";
import { playStory } from "../src/frame/playStory.ts";
import type { PlayTrace } from "../src/playTrace.ts";

/** A canvas for the plays: they never read it here. */
const CONTEXT = {
  args: {},
  canvasElement: {} as HTMLElement,
  text: (key: string): string => key,
  clock: heldStoryClock(0),
  globals: {},
  loaded: {},
  id: "kit:a-b--x",
  name: "X",
  title: "A/B",
  parameters: {}
};

describe("playStory", () => {
  it("says the play is over only once it finished", async () => {
    const events: string[] = [];
    await playStory(
      async (): Promise<void> => {
        await Promise.resolve();
        events.push("played");
      },
      CONTEXT,
      () => events.push("over")
    );
    expect(events).toEqual(["played", "over"]);
  });

  it("says it at once without a play, and after a failed play whose failure still rejects", async () => {
    const events: string[] = [];
    await playStory(undefined, CONTEXT, () => events.push("over"));
    const failing = playStory(
      (): Promise<void> => Promise.reject(new Error("The pill does not show passed")),
      CONTEXT,
      () => events.push("over after failure")
    );
    await expect(failing).rejects.toThrow("The pill does not show passed");
    expect(events).toEqual(["over", "over after failure"]);
  });

  it("traces a play: running, each named step, then passed, with times", async () => {
    const traces: PlayTrace[] = [];
    await playStory(
      async ({ step }): Promise<void> => {
        await step("open the menu", () => undefined);
        await step("pick the second item", async () => {
          await Promise.resolve();
        });
      },
      CONTEXT,
      () => undefined,
      (trace) => traces.push(trace)
    );
    const last = traces.at(-1);
    expect(traces[0]).toEqual({ status: "running", steps: [] });
    expect(last?.status).toBe("passed");
    expect(last?.steps.map((step) => [step.label, step.status])).toEqual([
      ["open the menu", "passed"],
      ["pick the second item", "passed"]
    ]);
    expect(typeof last?.ms).toBe("number");
  });

  it("traces where a play failed: the step and the play carry the message", async () => {
    const traces: PlayTrace[] = [];
    const failing = playStory(
      async ({ step }): Promise<void> => {
        await step("press Escape", () => {
          throw new Error("The menu stayed open");
        });
      },
      CONTEXT,
      () => undefined,
      (trace) => traces.push(trace)
    );
    await expect(failing).rejects.toThrow("The menu stayed open");
    const last = traces.at(-1);
    expect(last).toMatchObject({ status: "failed", error: "The menu stayed open" });
    expect(last?.steps[0]).toMatchObject({
      label: "press Escape",
      status: "failed",
      error: "The menu stayed open"
    });
  });

  it("traces nothing without a play", async () => {
    const traces: PlayTrace[] = [];
    await playStory(
      undefined,
      CONTEXT,
      () => undefined,
      (trace) => traces.push(trace)
    );
    expect(traces).toEqual([]);
  });
});

describe("runPlay", () => {
  it("says at once that a story without a play is over, and runs a play through the runner it loads", async () => {
    const events: string[] = [];
    void runPlay(undefined, CONTEXT, () => events.push("over at once"));
    expect(events).toEqual(["over at once"]);
    await runPlay(
      async (): Promise<void> => {
        await Promise.resolve();
        events.push("played");
      },
      CONTEXT,
      () => events.push("over")
    );
    expect(events).toEqual(["over at once", "played", "over"]);
    await expect(
      runPlay(
        (): Promise<void> => Promise.reject(new Error("failed")),
        CONTEXT,
        () => undefined
      )
    ).rejects.toThrow("failed");
  });
});
