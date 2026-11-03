// @vitest-environment happy-dom
/**
 * Tests for a story run in its frame, drawn by the DOM renderer: the contract between the frame and a framework holds
 * for something other than React (mount, new args, Replay, the matrix, an error).
 *
 * @module
 */

import { describe, expect, it, vi } from "vitest";

import { heldFrameClock } from "../src/frame/frameClock.ts";
import type { PlayToolsLoader } from "../src/frame/playStory.ts";
import type { MockTools } from "../src/frame/storyMocks.ts";
import { type LoadedStory, readStory } from "../src/frame/storyModule.ts";
import { runStory, type StoryControls, type StoryRunOptions } from "../src/frame/storyRun.ts";
import type { PanelArgs } from "../src/messages.ts";
import { domRenderer } from "./domRenderer.ts";

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
  story: LoadedStory,
  playTools?: PlayToolsLoader,
  onEvent: StoryRunOptions["onEvent"] = (): undefined => undefined,
  mockTools?: StoryRunOptions["mockTools"]
): Promise<{ readonly container: HTMLElement; readonly reports: Reports }> => {
  const container = document.createElement("div");
  document.body.append(container);
  const reports: Reports = { controls: undefined, errors: [] };
  const options: StoryRunOptions = {
    container,
    story,
    identity: { id: "kit:kit-badge--badge", name: "Badge", title: "Kit/Badge" },
    ...(playTools === undefined ? {} : { playTools }),
    ...(mockTools === undefined ? {} : { mockTools }),
    renderer: domRenderer,
    clock: heldFrameClock(0),
    texts: {},
    decorators: [],
    globals: {},
    resolveArgs: (args: PanelArgs): PanelArgs => args,
    onControlsReady: (controls: StoryControls): void => {
      reports.controls = controls;
    },
    onEvent,
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

  it("draws and plays the story with what its loaders returned", async () => {
    const seen: unknown[] = [];
    const { container } = await run(
      badge({
        loaders: [async (): Promise<Record<string, unknown>> => ({ label: "Loaded" })],
        render: (_args: unknown, context: { readonly loaded: Record<string, unknown> }): HTMLElement => {
          const element = document.createElement("span");
          element.textContent = String(context.loaded["label"]);
          return element;
        },
        play: (context: { readonly loaded: Record<string, unknown> }): void => {
          seen.push(context.loaded["label"]);
        }
      })
    );
    expect(container.textContent).toBe("Loaded");
    expect(seen).toEqual(["Loaded"]);
  });

  it("undoes the set-ups before mounting the story again, then sets them up anew", async () => {
    const events: string[] = [];
    let count = 0;
    const { reports } = await run(
      badge({
        beforeEach: (): (() => void) => {
          count += 1;
          const mount = count;
          events.push(`set up ${mount}`);
          return (): void => {
            events.push(`undone ${mount}`);
          };
        }
      })
    );
    controlsOf(reports).playAgain();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual(["set up 1", "undone 1", "set up 2"]);
  });

  it("keeps a story's mocks running when it is played again", async () => {
    vi.stubGlobal("navigator", {
      serviceWorker: { controller: {}, addEventListener: (): void => undefined }
    });
    const events: string[] = [];
    const tools: MockTools = {
      http: { all: (path: string): string => `all ${path}` },
      passthrough: (): string => "passthrough",
      setupWorker: () => ({
        start: async (): Promise<undefined> => {
          events.push("start");
          return undefined;
        },
        stop: (): void => {
          events.push("stop");
        }
      })
    };
    const { reports } = await run(
      badge({ parameters: { msw: { handlers: ["a"] } } }),
      undefined,
      undefined,
      async () => tools
    );
    controlsOf(reports).playAgain();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual(["start"]);
    vi.unstubAllGlobals();
  });

  it("shows the error of a loader that throws, and never gets ready", async () => {
    const { container, reports } = await run(
      badge({
        loaders: (): never => {
          throw new Error("No data");
        }
      })
    );
    expect(reports.errors).toEqual(["No data"]);
    expect(reports.controls).toBeUndefined();
    expect(container.textContent).toContain("No data");
  });

  it("hands the play the story's id, name, title and parameters, and the play tools when the project has them", async () => {
    const seen: Record<string, unknown>[] = [];
    const play = (context: Record<string, unknown>): void => {
      seen.push(context);
    };
    let loads = 0;
    const tools: PlayToolsLoader = async () => {
      loads += 1;
      return {
        within: (element: HTMLElement): string => `queries of ${element.tagName}`,
        userEvent: "events"
      };
    };
    await run(badge({ play, parameters: { layout: "centered" } }), tools);
    expect(seen[0]).toMatchObject({
      id: "kit:kit-badge--badge",
      name: "Badge",
      title: "Kit/Badge",
      parameters: { layout: "centered" },
      canvas: "queries of DIV",
      userEvent: "events"
    });
    await run(badge(), tools);
    expect(loads).toBe(1);
    await run(badge({ play }));
    expect(seen[1]).not.toHaveProperty("canvas");
  });

  it("draws the value a mapping's key stands for, from the story's args and from the panel's", async () => {
    const { container, reports } = await run(
      badge({
        args: { label: "short" },
        argTypes: { label: { options: ["short", "long"], mapping: { short: "New", long: "Brand new" } } }
      })
    );
    expect(container.textContent).toBe("New");
    controlsOf(reports).setPanelArgs({ label: "long" });
    expect(container.textContent).toBe("Brand new");
  });

  it("records a spy's calls and an argTypes action's, and the play still reads the spy's calls", async () => {
    const onPress = vi.fn();
    const calls: string[] = [];
    let wasCalled = false;
    await run(
      badge({
        args: { label: "New", onPress },
        argTypes: { onClose: { action: "closed" } },
        play: (context: { readonly args: Record<string, (value: string) => void> }): void => {
          context.args["onPress"]?.("a");
          context.args["onClose"]?.("b");
          wasCalled = vi.isMockFunction(context.args["onPress"]) && onPress.mock.calls.length === 1;
        }
      }),
      undefined,
      (name: string, values: readonly unknown[]): void => {
        calls.push(`${name}(${values.join(", ")})`);
      }
    );
    expect(calls).toEqual(["onPress(a)", "onClose(b)"]);
    expect(wasCalled).toBe(true);
  });

  it("mounts the story anew for another matrix only, and clears its spies before each mount", async () => {
    const onPress = vi.fn();
    let plays = 0;
    const { reports } = await run(
      badge({
        args: { label: "New", onPress },
        play: (context: { readonly args: Record<string, () => void> }): void => {
          plays += 1;
          context.args["onPress"]?.();
        }
      })
    );
    controlsOf(reports).setMatrix(undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(plays).toBe(1);
    controlsOf(reports).playAgain();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(plays).toBe(2);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
