/**
 * A play's tools, logged and held: a sync query stays sync and only logged, an async action waits at the gate, and each
 * keeps its result and its throw.
 *
 * @module
 */
// @vitest-environment happy-dom
import type { StepFunction } from "@forgebook/story-format/csf";
import { describe, expect, it } from "vitest";

import { type ActionRecorder, isSyncEvent, isSyncQuery, recordedTool } from "../src/frame/playActions.ts";
import { heldStepper } from "../src/frame/playStepper.ts";
import { playStory } from "../src/frame/playStory.ts";
import type { PlayTrace } from "../src/playTrace.ts";

/** A recorder that keeps what it is told. */
const recorderOf = (
  gated: string[] = []
): ActionRecorder & { readonly log: { label: string; status?: string }[] } => {
  const log: { label: string; status?: string }[] = [];
  return {
    log,
    gate: async (label: string): Promise<void> => {
      gated.push(label);
      await Promise.resolve();
    },
    begin: (label: string): number => log.push({ label }) - 1,
    end: (index: number, action: { label: string; status?: string }): void => {
      log[index] = action;
    }
  };
};

describe("recordedTool", () => {
  const canvas = {
    getByRole: (role: string): string => {
      if (role === "gone") throw new Error("not found");
      return `found ${role}`;
    },
    findByRole: (role: string): Promise<string> => Promise.resolve(`found ${role}`)
  };

  it("logs a sync query and returns at once, with no gate", () => {
    const gated: string[] = [];
    const recorder = recorderOf(gated);
    const tool = recordedTool(canvas, "canvas", recorder, isSyncQuery);
    expect(typeof tool === "object" && tool !== null && Reflect.get(tool, "getByRole")("button")).toBe(
      "found button"
    );
    expect(gated).toEqual([]);
    expect(recorder.log).toEqual([{ label: 'canvas.getByRole("button")', status: "passed", ms: 0 }]);
  });

  it("logs a throw, and throws it", () => {
    const recorder = recorderOf();
    const tool = recordedTool(canvas, "canvas", recorder, isSyncQuery);
    expect(() => typeof tool === "object" && tool !== null && Reflect.get(tool, "getByRole")("gone")).toThrow(
      "not found"
    );
    expect(recorder.log[0]?.status).toBe("failed");
  });

  it("holds an async action at the gate, and gives its result", async () => {
    const gated: string[] = [];
    const recorder = recorderOf(gated);
    const tool = recordedTool(canvas, "canvas", recorder, isSyncQuery);
    const found = await (typeof tool === "object" &&
      tool !== null &&
      Reflect.get(tool, "findByRole")("list"));
    expect(found).toBe("found list");
    expect(gated).toEqual(['canvas.findByRole("list")']);
    expect(recorder.log[0]?.status).toBe("passed");
  });

  it("logs what the instance of `setup` does", async () => {
    const recorder = recorderOf();
    const events = {
      setup: () => ({ click: (): Promise<void> => Promise.resolve() })
    };
    const tool = recordedTool(events, "userEvent", recorder, isSyncEvent);
    const instance = typeof tool === "object" && tool !== null ? Reflect.get(tool, "setup")() : undefined;
    await Reflect.get(instance, "click")("x");
    expect(recorder.log.map((each) => each.label)).toEqual(['userEvent.click("x")']);
  });

  it("names an element by its tag and its text", () => {
    const recorder = recorderOf();
    const tool = recordedTool(canvas, "canvas", recorder, isSyncQuery);
    const button = document.createElement("button");
    button.textContent = "Save";
    if (typeof tool === "object" && tool !== null) Reflect.get(tool, "getByRole")(button);
    expect(recorder.log[0]?.label).toBe('canvas.getByRole(<button> "Save")');
  });
});

describe("heldStepper", () => {
  it("lets every waiting action go on next, and holds no more after release", async () => {
    const stepper = heldStepper();
    const done: string[] = [];
    void stepper.wait().then(() => done.push("a"));
    void stepper.wait().then(() => done.push("b"));
    stepper.next();
    await expect.poll(() => done).toEqual(["a", "b"]);
    expect(stepper.isHolding()).toBe(true);
    stepper.release();
    expect(stepper.isHolding()).toBe(false);
  });
});

describe("a play stepped through", () => {
  it("stops before each step and tool's action until told, and runs on after continue", async () => {
    const traces: PlayTrace[] = [];
    const stepper = heldStepper();
    const done: string[] = [];
    const running = playStory(
      async ({
        step,
        userEvent
      }: {
        step: StepFunction;
        userEvent?: { click: (x: string) => Promise<void> };
      }) => {
        await step("first", async () => {
          await userEvent?.click("a");
          done.push("a");
        });
        await userEvent?.click("b");
        done.push("b");
      },
      { canvasElement: document.createElement("div") } as never,
      (): undefined => undefined,
      (trace: PlayTrace): void => void traces.push(trace),
      { within: (): object => ({}), userEvent: { click: (): Promise<void> => Promise.resolve() } },
      stepper
    );
    const pausedAt = async (label: string): Promise<void> => {
      await expect.poll(() => traces.at(-1)?.pausedAt).toBe(label);
    };
    await pausedAt("first");
    stepper.next();
    await pausedAt('userEvent.click("a")');
    expect(done).toEqual([]);
    stepper.next();
    await pausedAt('userEvent.click("b")');
    expect(done).toEqual(["a"]);
    stepper.release();
    await running;
    expect(done).toEqual(["a", "b"]);
    expect(traces.at(-1)?.status).toBe("passed");
    expect(traces.at(-1)?.actions?.map((action) => [action.label, action.step])).toEqual([
      ['userEvent.click("a")', 0],
      ['userEvent.click("b")', undefined]
    ]);
  });
});
