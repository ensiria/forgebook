// @vitest-environment happy-dom
/**
 * Tests for a story that changes its own args while it is drawn (Storybook's `useArgs`): the frame draws it again with
 * them, keeps them as the panel's values, and tells the shell the panel's values the change makes.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { heldFrameClock } from "../src/frame/frameClock.ts";
import { panelArgsOf } from "../src/frame/panelValues.ts";
import type { ArgsChange, MountedStory, StoryDrawing } from "../src/frame/renderer.ts";
import { type LoadedStory, readStory } from "../src/frame/storyModule.ts";
import { runStory, type StoryControls } from "../src/frame/storyRun.ts";
import type { PanelArgs } from "../src/messages.ts";
import { domRenderer } from "./domRenderer.ts";

/** A badge drawing its `label` and `tone` args, and the length of its `items`. */
const BADGE: LoadedStory = ((): LoadedStory => {
  const read = readStory(
    {
      default: { title: "Kit/Badge" },
      Badge: {
        args: { label: "New", tone: "info", items: [] },
        render: (args: { readonly label?: unknown; readonly tone?: unknown; readonly items?: unknown }) => {
          const element = document.createElement("span");
          const count = Array.isArray(args.items) ? args.items.length : 0;
          element.textContent = `${String(args.label)} ${String(args.tone)} ${count}`;
          return element;
        }
      }
    },
    "Badge"
  );
  if (typeof read === "string") throw new Error(read);
  return read;
})();

/** The badge run with a renderer that keeps its last drawing, so a test changes the args as the story's code would. */
const run = async (): Promise<{
  readonly container: HTMLElement;
  readonly told: PanelArgs[];
  readonly change: (change: ArgsChange) => void;
  readonly shown: () => Readonly<Record<string, unknown>>;
  readonly controls: () => StoryControls;
}> => {
  const container = document.createElement("div");
  document.body.append(container);
  const told: PanelArgs[] = [];
  let last: StoryDrawing | undefined;
  let controls: StoryControls | undefined;
  runStory({
    container,
    story: BADGE,
    identity: { id: "kit:kit-badge--badge", name: "Badge", title: "Kit/Badge" },
    renderer: {
      mount: (canvas: HTMLElement, drawing: StoryDrawing, onError: (error: Error) => void): MountedStory => {
        last = drawing;
        const mounted = domRenderer.mount(canvas, drawing, onError);
        return {
          ...mounted,
          update: (next: StoryDrawing): void => {
            last = next;
            mounted.update(next);
          }
        };
      }
    },
    clock: heldFrameClock(0),
    texts: {},
    pluginSetups: [],
    decorators: [],
    globals: {},
    resolveArgs: (args: PanelArgs): PanelArgs => args,
    onControlsReady: (next: StoryControls): void => {
      controls = next;
    },
    onEvent: (): undefined => undefined,
    panelArgsOf: (values: Readonly<Record<string, unknown>>): PanelArgs => panelArgsOf(values),
    onArgsChange: (args: PanelArgs): void => {
      told.push(args);
    },
    onError: (): undefined => undefined,
    onTrace: (): undefined => undefined
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return {
    container,
    told,
    change: (change: ArgsChange): void => {
      if (last?.changeArgs === undefined)
        throw new Error("The story was not drawn with a way to change its args");
      last.changeArgs(change);
    },
    shown: (): Readonly<Record<string, unknown>> => last?.args ?? {},
    controls: (): StoryControls => {
      if (controls === undefined) throw new Error("The story never got ready");
      return controls;
    }
  };
};

describe("a story's change of its own args", () => {
  it("draws the story again with them and tells the shell the panel's values it makes", async () => {
    const { container, told, change } = await run();
    change({ reset: [], set: { label: "Changed" } });
    expect(container.textContent).toBe("Changed info 0");
    expect(told).toEqual([{ label: "Changed" }]);
  });

  it("is kept over the story's own args as the panel's values are, and reset by name or all at once", async () => {
    const { container, change, controls, told } = await run();
    controls().setPanelArgs({ tone: "danger" });
    change({ reset: [], set: { label: "Changed" } });
    expect(container.textContent).toBe("Changed danger 0");
    // the panel's values and the story's change, together: a change right after holds both
    expect(told.at(-1)).toEqual({ tone: "danger", label: "Changed" });
    change({ reset: ["label"], set: {} });
    expect(container.textContent).toBe("New danger 0");
    change({ reset: "all", set: {} });
    expect(container.textContent).toBe("New info 0");
    expect(told.at(-1)).toEqual({});
  });

  it("keeps a value the panel cannot show when the panel's values come back without it", async () => {
    const { container, change, controls, told } = await run();
    change({ reset: [], set: { label: "Two", items: [(): number => 1, (): number => 2] } });
    expect(told.at(-1)).toEqual({ label: "Two" });
    // the shell answers with the panel's values, which hold no list of functions
    controls().setPanelArgs({ label: "Two" });
    expect(container.textContent).toBe("Two info 2");
    change({ reset: ["items"], set: {} });
    expect(container.textContent).toBe("Two info 0");
  });

  it("leaves out what is handed back as it was given", async () => {
    const { change, shown, told } = await run();
    change({ reset: [], set: { ...shown(), tone: "calm" } });
    expect(told.at(-1)).toEqual({ tone: "calm" });
  });
});
