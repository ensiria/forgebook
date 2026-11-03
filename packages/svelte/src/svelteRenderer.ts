/**
 * Forgebook's renderer for Svelte: draws a story in a canvas with a Svelte component of its own, with the texts and the
 * clock in the context and inside the catalogue's decorators, and catches what the story throws.
 *
 * @remarks
 * The frame runs everything else the same for every framework (`forgebook/renderer`): the play function, Replay, the
 * matrix, the error shown in place of the story.
 *
 * What a story reads (its args, the language, the switches, the clock) is held in values Svelte follows
 * (`storyCell.ts`), each on its own, and the host (`StoryHost.svelte`) draws the story's tree from them: new args draw
 * again what read them, and a component that stays the same keeps its state. The story is drawn once Svelte has settled,
 * so the frame's play function finds what an `await` in a component waited for.
 *
 * The server render is imported when it is asked for: the page never loads it, and only Node ever runs it. Svelte
 * compiles a component apart for a page and for a server, so it runs where the story's modules were compiled for the
 * server (Vitest in Node), as Svelte's own server render does.
 *
 * @module
 */
import type { StoryClock } from "@forgebook/story-format/clock";
import type { StoryContext } from "@forgebook/story-format/csf";
import { type StoryTextFunction, storyTextOf } from "@forgebook/story-format/texts";
import type { MountedStory, StoryDrawing, StoryRenderer } from "forgebook/renderer";
import { storyContextOf, untracedStep } from "forgebook/renderer";
import type { LoadedArgs } from "forgebook/story-module";
import { flushSync, mount, settled, unmount } from "svelte";

import StoryHost from "./StoryHost.svelte";
import { type StoryCell, storyCell } from "./storyCell.ts";
import { type StoryNode, storyNode } from "./storyNode.ts";
import { STORY_VIEW, type StoryView } from "./storyView.ts";
import { textSnippets } from "./textSnippet.ts";

/** What the host draws: the story's tree of the moment, and whether it failed. */
export type StoryScene = {
  /** The story's tree, made when it is read: what the story throws is thrown here, inside the host's boundary. */
  readonly node: StoryNode;
  /** Grows at each new try after an error, so the story is drawn anew. */
  readonly attempt: number;
  /** Whether the story threw, and is not drawn until it is tried again. */
  readonly isFailed: boolean;
  /**
   * Called by the host's boundary with what the story threw.
   *
   * @param error - the error.
   */
  readonly fail: (error: unknown) => void;
};

/** An error as the frame takes it. */
const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

/** What a story reads besides its args, each followed on its own. */
type ViewCells = {
  readonly [TField in "texts" | "clock" | "globals" | "loaded"]: StoryCell<StoryDrawing[TField]>;
};

/**
 * Whether two drawings draw the same story with the same decorators.
 *
 * @param current - the drawing on screen.
 * @param next - the new one.
 */
const isSameStory = (current: StoryDrawing, next: StoryDrawing): boolean =>
  current.story === next.story &&
  current.decorators.length === next.decorators.length &&
  current.decorators.every((decorator, index) => decorator === next.decorators[index]);

/**
 * What a render and a decorator receive, reading the moment's values when they are read: a render follows what it read
 * and nothing else.
 *
 * @param args - the args.
 * @param view - the rest of what the story reads.
 * @param scene - the drawing on screen.
 * @param canvas - the story's canvas.
 */
const liveContext = (
  args: StoryCell<LoadedArgs>,
  view: ViewCells,
  scene: StoryCell<StoryDrawing>,
  canvas: HTMLElement
): StoryContext<LoadedArgs> => ({
  get args(): LoadedArgs {
    return args.current;
  },
  step: untracedStep,
  canvasElement: canvas,
  get text(): StoryTextFunction {
    return storyTextOf(view.texts.current);
  },
  get clock(): StoryClock {
    return view.clock.current;
  },
  get globals(): StoryDrawing["globals"] {
    return view.globals.current;
  },
  get loaded(): StoryDrawing["loaded"] {
    return view.loaded.current;
  },
  get id(): string {
    return scene.current.identity.id;
  },
  get name(): string {
    return scene.current.identity.name;
  },
  get title(): string {
    return scene.current.identity.title;
  },
  get parameters(): Readonly<Record<string, unknown>> {
    return scene.current.story.parameters;
  }
});

/**
 * The context the story's components read, as a map for Svelte's `mount` and `render`.
 *
 * @param view - the texts and the clock, read when read.
 */
const viewContext = (view: StoryView): Map<symbol, StoryView> => new Map([[STORY_VIEW, view]]);

/**
 * Brings the view to a new drawing's values; the switches only when one changed, since they come as a new object.
 *
 * @param view - the view's values.
 * @param next - the new drawing.
 */
const assignView = (view: ViewCells, next: StoryDrawing): void => {
  if (JSON.stringify(view.globals.current) !== JSON.stringify(next.globals)) view.globals.set(next.globals);
  view.texts.set(next.texts);
  view.clock.set(next.clock);
  view.loaded.set(next.loaded);
};

/** Svelte as the frame draws with it. */
export const svelteRenderer: StoryRenderer = {
  mount: (canvas: HTMLElement, first: StoryDrawing, onError: (error: Error) => void): MountedStory => {
    const scene = storyCell(first);
    const args = storyCell(first.args);
    const view: ViewCells = {
      texts: storyCell(first.texts),
      clock: storyCell(first.clock),
      globals: storyCell(first.globals),
      loaded: storyCell(first.loaded)
    };
    const attempt = storyCell(0);
    const failed = storyCell(false);
    // the same as `failed`, read where nothing must follow it
    let hasFailed = false;
    const context = liveContext(args, view, scene, canvas);
    const snippetOf = textSnippets();
    let markDrawn = (): void => undefined;
    const drawn = new Promise<void>((resolve) => {
      markDrawn = resolve;
    });
    const host: StoryScene = {
      get node(): StoryNode {
        return storyNode(scene.current.story, context, scene.current.decorators, snippetOf);
      },
      get attempt(): number {
        return attempt.current;
      },
      get isFailed(): boolean {
        return failed.current;
      },
      fail: (error: unknown): void => {
        if (!hasFailed) onError(toError(error));
        hasFailed = true;
        failed.set(true);
      }
    };
    const instance = mount(StoryHost, {
      target: canvas,
      props: { scene: host },
      context: viewContext({
        get texts(): StoryView["texts"] {
          return view.texts.current;
        },
        get clock(): StoryView["clock"] {
          return view.clock.current;
        }
      })
    });
    // once Svelte has settled, unless the story threw: tried again after an error, a story drawn at last is drawn
    const markDrawnOnceSettled = (): void => {
      void settled().then(() => {
        if (!hasFailed) markDrawn();
      });
    };
    // the effects run now, `onMount` among them: a story that throws there is not drawn
    flushSync();
    markDrawnOnceSettled();
    return {
      drawn,
      update: (next: StoryDrawing): void => {
        args.set(next.args);
        assignView(view, next);
        if (!isSameStory(scene.current, next)) scene.set(next);
        if (hasFailed) {
          hasFailed = false;
          failed.set(false);
          attempt.set(attempt.current + 1);
          markDrawnOnceSettled();
        }
      },
      unmount: (): void => {
        void unmount(instance);
      }
    };
  },
  renderToString: async (drawing: StoryDrawing): Promise<string> => {
    const { render } = await import("svelte/server");
    const context = storyContextOf(drawing, drawing.args, () => document.body);
    const snippetOf = textSnippets();
    const scene: StoryScene = {
      get node(): StoryNode {
        return storyNode(drawing.story, context, drawing.decorators, snippetOf);
      },
      attempt: 0,
      isFailed: false,
      fail: (): void => undefined
    };
    const output = await render(StoryHost, {
      props: { scene },
      context: viewContext({ texts: drawing.texts, clock: drawing.clock })
    });
    return output.body;
  }
};
