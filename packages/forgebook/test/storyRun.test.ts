// @vitest-environment happy-dom
/**
 * Tests for a story run in its frame, drawn by the DOM renderer: the contract between the frame and a framework holds
 * for something other than React (mount, new args, Replay, the matrix, an error).
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { heldFrameClock } from "../src/frame/frameClock";
import { type LoadedStory, readStory } from "../src/frame/storyModule";
import { runStory, type StoryControls, type StoryRunOptions } from "../src/frame/storyRun";
import type { PanelArgs } from "../src/messages";
import { domRenderer } from "./domRenderer";

/** What a run told the frame. */
type Reports = {
  /** The controls, once the story was drawn and played. */
  controls: StoryControls | undefined;
  /** The errors' messages. */
  readonly errors: string[];
};

/**
 * A story from a story file's exports, as the frame reads it.
 *
 * @param story - the story's export.
 */
const loaded = (story: Record<string, unknown>): LoadedStory => {
  const read = readStory({ default: { title: "Kit/Badge" }, Badge: story }, "Badge");
  if (typeof read === "string") throw new Error(read);
  return read;
};

/** A story drawing a badge with its `label` arg, failing on the label `boom`. */
const badge = (extra: Record<string, unknown> = {}): LoadedStory =>
  loaded({
    args: { label: "New" },
    render: (args: { readonly label?: unknown }): HTMLElement => {
      if (args.label === "boom") throw new Error("The badge cannot say boom");
      const element = document.createElement("span");
      element.textContent = String(args.label);
      return element;
    },
    ...extra
  });

/**
 * Runs a story in a new container and waits for its play.
 *
 * @param story - the story.
 * @returns the container and what the run reported.
 */
const run = async (
  story: LoadedStory
): Promise<{ readonly container: HTMLElement; readonly reports: Reports }> => {
  const container = document.createElement("div");
  document.body.append(container);
  const reports: Reports = { controls: undefined, errors: [] };
  const options: StoryRunOptions = {
    container,
    story,
    renderer: domRenderer,
    clock: heldFrameClock(0),
    texts: {},
    wrap: undefined,
    resolveArgs: (args: PanelArgs): PanelArgs => args,
    onControlsReady: (controls: StoryControls): void => {
      reports.controls = controls;
    },
    onEvent: () => undefined,
    onError: (message: string): void => {
      reports.errors.push(message);
    },
    onTrace: () => undefined
  };
  runStory(options);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { container, reports };
};

/** The controls of a run that is ready. */
const controlsOf = (reports: Reports): StoryControls => {
  if (reports.controls === undefined) throw new Error("The story never got ready");
  return reports.controls;
};

describe("runStory with a second framework", () => {
  it("draws the story in a canvas with its layout, then plays it on that canvas and is ready", async () => {
    let playedOn: HTMLElement | undefined;
    const { container, reports } = await run(
      badge({
        play: ({ canvasElement }: { readonly canvasElement: HTMLElement }): void => {
          playedOn = canvasElement;
        }
      })
    );
    const canvas = container.querySelector<HTMLElement>(".forgebook-frame");
    expect(canvas?.dataset["layout"]).toBe("padded");
    expect(canvas?.textContent).toBe("New");
    expect(playedOn).toBe(canvas);
    expect(reports.controls).toBeDefined();
  });

  it("draws the story again with the panel's values, in the same canvas", async () => {
    const { container, reports } = await run(badge());
    const canvas = container.querySelector(".forgebook-frame");
    controlsOf(reports).setPanelArgs({ label: "Sale" });
    expect(container.querySelector(".forgebook-frame")).toBe(canvas);
    expect(canvas?.textContent).toBe("Sale");
  });

  it("mounts the story anew on Replay, and plays it again", async () => {
    let plays = 0;
    const { container, reports } = await run(
      badge({
        parameters: { replay: "remount" },
        play: (): void => {
          plays += 1;
        }
      })
    );
    const first = container.querySelector(".forgebook-frame");
    await controlsOf(reports).replay();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector(".forgebook-frame")).not.toBe(first);
    expect(plays).toBe(2);
  });

  it("draws one cell per value of the matrix, without playing them", async () => {
    let plays = 0;
    const { container, reports } = await run(
      badge({
        play: (): void => {
          plays += 1;
        }
      })
    );
    controlsOf(reports).setMatrix({ rows: { name: "label", values: ["One", "Two"] } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const cells = [...container.querySelectorAll(".forgebook-matrix__story")].map((cell) => cell.textContent);
    expect(cells).toEqual(["One", "Two"]);
    expect(plays).toBe(1);
  });

  it("shows the error in place of a story that throws, and draws it again once the value is changed back", async () => {
    const { container, reports } = await run(badge());
    const controls = controlsOf(reports);
    controls.setPanelArgs({ label: "boom" });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("The badge cannot say boom");
    expect(reports.errors).toEqual(["The badge cannot say boom"]);
    controls.setPanelArgs({ label: "Fine" });
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector(".forgebook-frame")?.textContent).toBe("Fine");
  });

  it("never gets ready when the story throws as it is first drawn", async () => {
    const { container, reports } = await run(badge({ args: { label: "boom" } }));
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(reports.controls).toBeUndefined();
  });
});
