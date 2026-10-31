/**
 * One story run in its frame, whatever framework draws it: the args (the story's, the panel's, the texts named by key,
 * the recorded events), the play function, Replay, the matrix, the story clock a Live story reads and the
 * error shown in place of a story that throws.
 *
 * @remarks
 * The framework only draws (`renderer.ts`); everything a story does over time is here, so each framework behaves the
 * same. The play function runs once per mount, like a test, not on every change of the args, and reads the args of
 * the moment it runs. Every mount runs the story's loaders and set-ups first (`storyHooks.ts`), after the cleanups of
 * the mount before.
 *
 * @module
 */

import { type StoryTextTable, storyTextOf } from "@forgebook/story-format/texts";

import { actionNames, mappedArgs } from "../argTypes.ts";
import type { Matrix } from "../matrix.ts";
import type { PanelArgs } from "../messages.ts";
import type { PlayTrace } from "../playTrace.ts";
import type { ClockState } from "../storyClock.ts";
import { withStoryTexts } from "../storyTexts.ts";
import type { FrameClock } from "./frameClock.ts";
import { matrixLayout } from "./matrixLayout.ts";
import { type PlayTools, type PlayToolsLoader, playStory } from "./playStory.ts";
import type { MountedStory, StoryDrawing, StoryIdentity, StoryRenderer } from "./renderer.ts";
import { animationsSettled } from "./settle.ts";
import { storyCanvas } from "./storyCanvas.ts";
import { type PreparedStory, prepareStory } from "./storyHooks.ts";
import type { LoadedArgs, LoadedStory } from "./storyModule.ts";

/** What the shell can do to a running story. */
export type StoryControls = {
  /** Replays the story, as it declares. */
  readonly replay: () => Promise<void>;
  /** Sets the props panel's values over the story's own args. */
  readonly setPanelArgs: (args: PanelArgs) => void;
  /** Records the calls of these events. */
  readonly setEvents: (names: readonly string[]) => void;
  /** Draws the story once per value of the matrix's axes; none draws it alone. */
  readonly setMatrix: (matrix: Matrix | undefined) => void;
  /** Mounts the story again, so its play function runs again. */
  readonly playAgain: () => void;
  /** Sets whether the story clock runs, and how fast. */
  readonly setClock: (state: ClockState) => void;
  /**
   * Brings the story clock back to its start and mounts the story again, so its own state starts over too and its
   * play function runs again.
   */
  readonly restartClock: () => void;
};

/** What a story run needs. */
export type StoryRunOptions = {
  /** The element the story, its matrix or its error are drawn in. */
  readonly container: HTMLElement;
  /** The story. */
  readonly story: LoadedStory;
  /** Which story it is: its context's id, name and title. */
  readonly identity: StoryIdentity;
  /** Loads the play tools the project installed, for the first play; none without them. */
  readonly playTools?: PlayToolsLoader;
  /** The framework that draws it. */
  readonly renderer: StoryRenderer;
  /** The story clock the story reads: running from its start for a Live story, held otherwise. */
  readonly clock: FrameClock;
  /** The texts inside the stories in the shown language. */
  readonly texts: StoryTextTable;
  /** The catalogue's decorators, outside the story's own. */
  readonly decorators: StoryDrawing["decorators"];
  /** The values of the switches applied by code, by id. */
  readonly globals: StoryDrawing["globals"];
  /** The panel's values as the story takes them (a named value turned back into the value). */
  readonly resolveArgs: (args: PanelArgs) => Readonly<Record<string, unknown>>;
  /**
   * Called once with the controls, when the story is first drawn and its play function is over (the frame's ready
   * status waits for it, so no check reads a half-played story).
   */
  readonly onControlsReady: (controls: StoryControls) => void;
  /** Called on every call of a recorded event, with its arguments. */
  readonly onEvent: (name: string, values: readonly unknown[]) => void;
  /** Called with the message when the story throws while it is drawn; the frame shows the error instead. */
  readonly onError: (message: string) => void;
  /** Called with the play function's trace after every change. */
  readonly onTrace: (trace: PlayTrace) => void;
};

/**
 * The error shown in place of a story that threw: its message and its stack.
 *
 * @param document - the frame's document.
 * @param error - the error.
 */
const errorElement = (document: Document, error: Error): HTMLElement => {
  const box = document.createElement("div");
  box.className = "forgebook-frame-error";
  box.setAttribute("role", "alert");
  const message = document.createElement("p");
  message.className = "forgebook-frame-error__message";
  message.textContent = error.message;
  box.append(message);
  if (error.stack !== undefined) {
    const stack = document.createElement("pre");
    stack.className = "forgebook-frame-error__stack";
    stack.textContent = error.stack;
    box.append(stack);
  }
  return box;
};

/** What the frame changes in a running story when the shell sends a new view: no new mount, the story keeps its state. */
export type RunningStory = {
  /** Takes the story away and runs its set-ups' cleanups: the frame's page is being left. */
  readonly leave: () => void;
  /**
   * Draws the story in another language, or with other values of the switches applied by code (the language's
   * provider reads its id among them).
   *
   * @param shown - the texts of the language now shown, and the switches' values.
   */
  readonly setShown: (shown: Pick<StoryDrawing, "texts" | "globals">) => void;
};

/** A story's handler of an event, as the frame calls it. */
type Handler = (...values: unknown[]) => unknown;

/**
 * Whether an arg is a handler the frame can wrap: a function, taken with the signature an event's handler has.
 *
 * @param value - the arg.
 */
const isHandler = (value: unknown): value is Handler => typeof value === "function";

/**
 * Clears the calls of the spies among a story's args, as Storybook does before it draws a story: each mount's play
 * counts its own calls.
 *
 * @param args - the story's args.
 */
const clearSpies = (args: LoadedArgs): void => {
  for (const value of Object.values(args)) {
    const clear: unknown = typeof value === "function" ? Reflect.get(value, "mockClear") : undefined;
    if (typeof clear === "function") Reflect.apply(clear, value, []);
  }
};

/** A story before its loaders ran, or after its set-ups were undone: nothing loaded, nothing to undo. */
const NOT_PREPARED: PreparedStory = { loaded: {}, cleanup: async (): Promise<void> => undefined };

/**
 * Runs a story in its container.
 *
 * @param options - the story, its framework, its clock, texts and language, and what to tell the shell.
 * @returns what the frame can change while it runs.
 */
export const runStory = (options: StoryRunOptions): RunningStory => {
  const { container, story, renderer, clock } = options;
  const document = container.ownerDocument;
  const { decorators } = options;
  let { texts, globals } = options;
  let text = storyTextOf(texts);
  let args: LoadedArgs = story.args;
  let eventNames: readonly string[] = [];
  let matrix: Matrix | undefined;
  let mounted: { readonly story: MountedStory; readonly values: LoadedArgs }[] = [];
  let shownError: HTMLElement | undefined;
  let mountCount = 0;
  let hasPlayed = false;
  let prepared: PreparedStory = NOT_PREPARED;

  // the story's actions are recorded whatever the shell names: a spy, an `argTypes` action
  const actions = actionNames(story.args, story.argTypes);
  // every recorded event reports its calls, then runs the story's own handler when it has one; the handler is
  // wrapped, not replaced, so a spy stays one (`expect(args.onPress).toHaveBeenCalled()` reads its calls)
  const recorded = (): LoadedArgs =>
    Object.fromEntries(
      [...new Set([...eventNames, ...actions])].map((name) => {
        const own = args[name];
        const report = (values: readonly unknown[]): void => options.onEvent(name, values);
        if (!isHandler(own)) {
          return [
            name,
            (...values: unknown[]): undefined => {
              report(values);
              return undefined;
            }
          ];
        }
        return [
          name,
          new Proxy(own, {
            apply: (target: Handler, thisArg: unknown, values: unknown[]): unknown => {
              report(values);
              return Reflect.apply(target, thisArg, values);
            }
          })
        ];
      })
    );
  // an arg written `storyText("key")` reaches the story as the text of the shown language
  // an arg holding a key of its `mapping` reaches the story as the value the key stands for
  const shownArgs = (): LoadedArgs => ({
    ...withStoryTexts(mappedArgs(args, story.argTypes), text),
    ...recorded()
  });
  const drawing = (values: LoadedArgs): StoryDrawing => ({
    identity: options.identity,
    story,
    args: { ...shownArgs(), ...values },
    texts,
    clock,
    decorators,
    globals,
    loaded: prepared.loaded
  });

  const clearError = (): void => {
    shownError?.remove();
    shownError = undefined;
    for (const child of container.children) if (child instanceof HTMLElement) child.hidden = false;
  };
  const showError = (error: Error): void => {
    shownError?.remove();
    for (const child of container.children) if (child instanceof HTMLElement) child.hidden = true;
    shownError = errorElement(document, error);
    container.append(shownError);
    options.onError(error.message);
  };
  const unmountAll = (): void => {
    for (const { story: each } of mounted) each.unmount();
    mounted = [];
    clearError();
    container.replaceChildren();
  };

  const controls: StoryControls = {
    replay: async (): Promise<void> => {
      const mode = story.replay;
      if (mode === undefined) return;
      if (mode === "remount") {
        mountStory();
        return;
      }
      // an exit and an entrance: the arg goes false, the exit plays to its end, it stays false for the hold, then it
      // comes back
      args = { ...args, [mode.toggle]: false };
      redraw();
      await animationsSettled(document);
      if (mode.hold !== undefined) await new Promise((resolve) => window.setTimeout(resolve, mode.hold));
      args = { ...args, [mode.toggle]: true };
      redraw();
    },
    setPanelArgs: (panelArgs: PanelArgs): void => {
      args = { ...story.args, ...options.resolveArgs(panelArgs) };
      redraw();
    },
    setEvents: (names: readonly string[]): void => {
      eventNames = names;
      redraw();
    },
    // the shell sends the matrix when the story is ready: the same one again must not mount the story anew (its play
    // would run twice)
    setMatrix: (next: Matrix | undefined): void => {
      if (JSON.stringify(next) === JSON.stringify(matrix)) return;
      matrix = next;
      mountStory();
    },
    playAgain: (): void => mountStory(),
    setClock: clock.setState,
    restartClock: (): void => {
      clock.restart();
      mountStory();
    }
  };

  // new args (the panel, Replay, the events) draw the story again: a value that made it throw can be changed back
  const redraw = (): void => {
    clearError();
    for (const { story: each, values } of mounted) each.update(drawing(values));
  };

  const mountMatrix = (axes: Matrix): void => {
    const layout = matrixLayout(document, story, axes);
    container.append(layout.element);
    mounted = layout.cells.map((cell) => ({
      story: renderer.mount(cell.canvas, drawing(cell.values), showError),
      values: cell.values
    }));
  };

  const mountAlone = (): void => {
    const count = mountCount;
    const canvas = storyCanvas(document, story);
    container.append(canvas);
    const alone = renderer.mount(canvas, drawing({}), showError);
    mounted = [{ story: alone, values: {} }];
    void alone.drawn.then(async () => {
      // a later mount (Replay, the matrix) replaced this one before it was drawn: its play would drive a gone story
      if (count !== mountCount) return;
      const tools = await playTools();
      if (count !== mountCount || tools instanceof Error) return;
      // a failed play still ends the wait; its rejection reaches the page as an error the tests record
      void playStory(
        story.play,
        {
          ...options.identity,
          args: shownArgs(),
          canvasElement: canvas,
          text,
          clock,
          globals,
          loaded: prepared.loaded,
          parameters: story.parameters
        },
        (): void => {
          if (hasPlayed) return;
          hasPlayed = true;
          options.onControlsReady(controls);
        },
        options.onTrace,
        tools
      );
    });
  };

  // the play tools the project installed, loaded for a story with a play; a failure to load them is shown as the
  // story's error
  const playTools = async (): Promise<PlayTools | undefined | Error> => {
    if (story.play === undefined) return undefined;
    try {
      return await options.playTools?.();
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      showError(failure);
      return failure;
    }
  };

  // the set-ups of the mount before undone, then the story's loaders and set-ups: whether this mount is still the last
  // one, and may draw
  const prepareMount = async (count: number): Promise<boolean> => {
    clearSpies(story.args);
    // taken before waiting: a mount that starts meanwhile must not undo the same set-ups again
    const previous = prepared;
    prepared = NOT_PREPARED;
    try {
      await previous.cleanup();
      const next = await prepareStory(story, {
        ...options.identity,
        args: shownArgs(),
        text,
        clock,
        globals,
        parameters: story.parameters
      });
      // a later mount started while this one loaded: its set-ups are undone, the later one draws
      if (count !== mountCount) {
        await next.cleanup();
        return false;
      }
      prepared = next;
      return true;
    } catch (error) {
      if (count === mountCount) showError(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  };

  // a new mount draws the story from scratch: its loaders and set-ups run again, its own state starts over and its
  // play function runs again
  const mountStory = (): void => {
    unmountAll();
    mountCount += 1;
    void prepareMount(mountCount).then((isLast) => {
      if (!isLast) return;
      // a framework may throw while it starts drawing, before its own error capture is in place: shown as any error
      try {
        if (matrix === undefined) mountAlone();
        else mountMatrix(matrix);
      } catch (error) {
        showError(error instanceof Error ? error : new Error(String(error)));
      }
    });
  };

  mountStory();
  return {
    leave: (): void => {
      mountCount += 1;
      unmountAll();
      const previous = prepared;
      prepared = NOT_PREPARED;
      void previous.cleanup();
    },
    setShown: (shown: Pick<StoryDrawing, "texts" | "globals">): void => {
      ({ texts, globals } = shown);
      text = storyTextOf(texts);
      redraw();
    }
  };
};
