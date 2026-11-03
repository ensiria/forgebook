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
import type { MountedStory, StoryDrawing } from "../src/frame/renderer.ts";
import { type LoadedStory, readStory } from "../src/frame/storyModule.ts";
import {
  type RunningStory,
  runStory,
  type StoryControls,
  type StoryRunOptions
} from "../src/frame/storyRun.ts";
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
  pluginSetups: StoryRunOptions["pluginSetups"] = []
): Promise<{
  readonly container: HTMLElement;
  readonly reports: Reports;
  readonly running: RunningStory;
}> => {
  const container = document.createElement("div");
  document.body.append(container);
  const reports: Reports = { controls: undefined, errors: [] };
  const options: StoryRunOptions = {
    container,
    story,
    identity: { id: "kit:kit-badge--badge", name: "Badge", title: "Kit/Badge" },
    ...(playTools === undefined ? {} : { playTools }),
    pluginSetups,
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
    panelArgsOf: (): PanelArgs => ({}),
    onArgsChange: (): undefined => undefined,
    onError: (message: string): void => {
      reports.errors.push(message);
    },
    onTrace: () => undefined
  };
  const running = runStory(options);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { container, reports, running };
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

  it("draws a story its edited file changed in the same canvas, the panel's values kept over its new args", async () => {
    const { container, reports, running } = await run(badge({ args: { label: "New", tone: "plain" } }));
    const canvas = container.querySelector(".forgebook-frame");
    controlsOf(reports).setPanelArgs({ tone: "loud" });
    running.setStory(
      loaded({
        args: { label: "Edited", tone: "plain" },
        render: (args: { readonly label?: unknown; readonly tone?: unknown }): HTMLElement => {
          const element = document.createElement("span");
          element.textContent = `${String(args.label)} ${String(args.tone)}`;
          return element;
        }
      })
    );
    expect(container.querySelector(".forgebook-frame")).toBe(canvas);
    expect(canvas?.textContent).toBe("Edited loud");
  });

  it("mounts a story with a play its edited file changed anew, and plays it again", async () => {
    let plays = 0;
    const play = (): void => {
      plays += 1;
    };
    const { container, running } = await run(badge({ play }));
    const first = container.querySelector(".forgebook-frame");
    running.setStory(badge({ args: { label: "Edited" }, play }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector(".forgebook-frame")).not.toBe(first);
    expect(container.querySelector(".forgebook-frame")?.textContent).toBe("Edited");
    expect(plays).toBe(2);
  });

  it("mounts a story with loaders its edited file changed anew, so the loaders run again", async () => {
    let loads = 0;
    const loaders = [
      async (): Promise<Record<string, unknown>> => {
        loads += 1;
        return {};
      }
    ];
    const { running } = await run(badge({ loaders }));
    running.setStory(badge({ args: { label: "Edited" }, loaders }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(loads).toBe(2);
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

  it("runs a plugin's preparation ahead of the story's loaders, and undoes it after the story's set-ups", async () => {
    const order: string[] = [];
    const { reports } = await run(
      badge({
        loaders: [
          (): undefined => {
            order.push("loader");
            return undefined;
          }
        ],
        beforeEach: [
          (): (() => void) => {
            order.push("set-up");
            return (): void => void order.push("story undone");
          }
        ]
      }),
      undefined,
      undefined,
      [
        (): (() => void) => {
          order.push("plugin");
          return (): void => void order.push("plugin undone");
        }
      ]
    );
    controlsOf(reports).playAgain();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order.slice(0, 5)).toEqual(["plugin", "loader", "set-up", "story undone", "plugin undone"]);
  });

  it("never holds two mounts' preparations at once, and skips one overtaken", async () => {
    let running = 0;
    let most = 0;
    let started = 0;
    const { reports } = await run(badge(), undefined, undefined, [
      async (): Promise<() => Promise<void>> => {
        started += 1;
        running += 1;
        most = Math.max(most, running);
        await new Promise((resolve) => setTimeout(resolve, 1));
        return async (): Promise<void> => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          running -= 1;
        };
      }
    ]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const controls = controlsOf(reports);
    controls.playAgain();
    controls.playAgain();
    controls.playAgain();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(most).toBe(1);
    expect(started).toBe(2);
  });

  it("goes on after a cleanup that never ends, so a request held open cannot leave a story blank", async () => {
    vi.useFakeTimers();
    let prepared = 0;
    const started = run(badge(), undefined, undefined, [
      (): (() => Promise<void>) => {
        prepared += 1;
        return (): Promise<void> => new Promise(() => undefined);
      }
    ]);
    await vi.advanceTimersByTimeAsync(1);
    const { reports } = await started;
    controlsOf(reports).playAgain();
    await vi.advanceTimersByTimeAsync(2100);
    vi.useRealTimers();
    expect(prepared).toBe(2);
  });

  it("undoes a plugin's preparation when the story's own cleanup throws", async () => {
    let isUndone = false;
    const { reports } = await run(
      badge({
        beforeEach: [
          (): (() => void) => (): void => {
            throw new Error("No cleanup");
          }
        ]
      }),
      undefined,
      undefined,
      [
        (): (() => void) => (): void => {
          isUndone = true;
        }
      ]
    );
    controlsOf(reports).playAgain();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(isUndone).toBe(true);
  });

  it("shows what a plugin's preparation throws as the story's error", async () => {
    const { reports } = await run(badge(), undefined, undefined, [
      (): undefined => {
        throw new Error("No worker");
      }
    ]);
    expect(reports.errors).toEqual(["No worker"]);
  });

  it("undoes a plugin's preparation when the story's own set-up fails", async () => {
    let isUndone = false;
    const { reports } = await run(
      badge({
        beforeEach: [
          (): undefined => {
            throw new Error("No data");
          }
        ]
      }),
      undefined,
      undefined,
      [
        (): (() => void) => (): void => {
          isUndone = true;
        }
      ]
    );
    expect(reports.errors).toEqual(["No data"]);
    expect(isUndone).toBe(true);
  });

  it("lists a call the framework reports, as a router's push, among the story's events", async () => {
    const calls: string[] = [];
    const container = document.createElement("div");
    document.body.append(container);
    runStory({
      container,
      story: badge(),
      identity: { id: "kit:kit-badge--badge", name: "Badge", title: "Kit/Badge" },
      renderer: {
        ...domRenderer,
        mount: (
          canvas: HTMLElement,
          drawing: StoryDrawing,
          onError: (error: Error) => void
        ): MountedStory => {
          drawing.onEvent?.("router.push", ["/about"]);
          return domRenderer.mount(canvas, drawing, onError);
        }
      },
      clock: heldFrameClock(0),
      texts: {},
      pluginSetups: [],
      decorators: [],
      globals: {},
      resolveArgs: (args: PanelArgs): PanelArgs => args,
      onControlsReady: (): undefined => undefined,
      onEvent: (name: string, values: readonly unknown[]): void => {
        calls.push(`${name}(${values.join(", ")})`);
      },
      panelArgsOf: (): PanelArgs => ({}),
      onArgsChange: (): undefined => undefined,
      onError: (): undefined => undefined,
      onTrace: () => undefined
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toEqual(["router.push(/about)"]);
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
