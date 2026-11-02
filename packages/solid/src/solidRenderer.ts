/**
 * Forgebook's renderer for Solid: draws a story in a canvas with Solid's `render`, with the texts and the clock
 * provided and inside the catalogue's decorators, and catches what the story throws.
 *
 * @remarks
 * The frame runs everything else the same for every framework (`forgebook/renderer`): the play function, Replay, the
 * matrix, the error shown in place of the story.
 *
 * A Solid story runs once. New args do not draw it again: they go into the args it already holds, one signal per value
 * (`liveRecord.ts`), and only what reads a changed value updates, so the story keeps its state the way a Solid app
 * keeps it. The language, the switches, the clock and the loaders' results are signals too, each on its own. The story
 * is made again only when another story takes its place, or to try again after an error.
 *
 * A `Suspense` around the story waits for what it suspends on (a resource read inside it), so the frame's play
 * function finds the story drawn.
 *
 * On a server, `solid-js/web` is Solid's server build, whose `renderToStringAsync` waits for the story's resources;
 * in a page it is the browser build, whose `render` this module uses. Each build refuses the other's call, which no
 * one makes: the frame never renders to a string, and the generated server tests never mount.
 *
 * Written without JSX, so the package needs no compiler of its own: the stories' JSX is compiled by the catalogue's
 * Vite, with Solid's plugin.
 *
 * @module
 */
import type { StoryClock } from "@forgebook/story-format/clock";
import type { StoryContext } from "@forgebook/story-format/csf";
import {
  type StoryTextFunction,
  type StoryTextTable,
  type StoryTextValues,
  storyTextOf
} from "@forgebook/story-format/texts";
import type { MountedStory, StoryDrawing, StoryRenderer } from "forgebook/renderer";
import { storyContextOf, untracedStep } from "forgebook/renderer";
import type { LoadedArgs } from "forgebook/story-module";
import {
  type Accessor,
  createComponent,
  createSignal,
  ErrorBoundary,
  type JSX,
  onMount,
  Show,
  Suspense
} from "solid-js";
import { render, renderToStringAsync } from "solid-js/web";

import { StoryClockContext } from "./clock.ts";
import { liveRecord } from "./liveRecord.ts";
import { storyNode } from "./storyNode.ts";
import { StoryTextsContext } from "./texts.ts";

/** An error as the frame takes it. */
const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

/**
 * Whether two drawings draw the same story: by its id, as the frame names it. A drawing of the same story is the same
 * story drawn again with other values, however it was read (the frame reads it once; a test may read it anew), so its
 * args, switches and texts go into what it holds; another story starts over.
 *
 * @param current - the drawing on screen.
 * @param next - the new one.
 */
const isSameStory = (current: StoryDrawing, next: StoryDrawing): boolean =>
  current.identity.id === next.identity.id;

/**
 * The story in the texts' and the clock's providers; the language's provider is a decorator of the catalogue's
 * preview, inside these.
 *
 * @param texts - the shown language's texts.
 * @param clock - the story's clock.
 * @param story - draws the story.
 */
const inProviders = (
  texts: Accessor<StoryTextTable>,
  clock: Accessor<StoryClock>,
  story: () => JSX.Element
): JSX.Element =>
  createComponent(StoryTextsContext.Provider, {
    value: texts,
    get children(): JSX.Element {
      return createComponent(StoryClockContext.Provider, {
        value: clock,
        get children(): JSX.Element {
          return story();
        }
      });
    }
  });

/** What a story reads besides its args, each a signal of its own. */
type StoryView = {
  /** The shown language's texts. */
  readonly texts: Accessor<StoryTextTable>;
  /** The story's clock. */
  readonly clock: Accessor<StoryClock>;
  /** The switches' values, value by value. */
  readonly globals: Readonly<Record<string, string>>;
  /** What the story's loaders returned. */
  readonly loaded: Accessor<Readonly<Record<string, unknown>>>;
  /** The drawing on screen, for its identity and parameters. */
  readonly scene: Accessor<StoryDrawing>;
};

/**
 * What a render and a decorator receive, reading the moment's values when they are read: what reads them inside JSX
 * follows them.
 *
 * @param args - the live args.
 * @param view - the live view.
 * @param canvas - the story's canvas.
 */
const liveContext = (args: LoadedArgs, view: StoryView, canvas: HTMLElement): StoryContext<LoadedArgs> => ({
  args,
  step: untracedStep,
  canvasElement: canvas,
  get text(): StoryTextFunction {
    return (key: string, values?: StoryTextValues): string => storyTextOf(view.texts())(key, values);
  },
  get clock(): StoryClock {
    return view.clock();
  },
  globals: view.globals,
  get loaded(): Readonly<Record<string, unknown>> {
    return view.loaded();
  },
  get id(): string {
    return view.scene().identity.id;
  },
  get name(): string {
    return view.scene().identity.name;
  },
  get title(): string {
    return view.scene().identity.title;
  },
  get parameters(): Readonly<Record<string, unknown>> {
    return view.scene().story.parameters;
  }
});

/** Solid as the frame draws with it. */
export const solidRenderer: StoryRenderer = {
  mount: (canvas: HTMLElement, first: StoryDrawing, onError: (error: Error) => void): MountedStory => {
    const args = liveRecord(first.args);
    const globals = liveRecord(first.globals);
    const [texts, setTexts] = createSignal(first.texts);
    const [clock, setClock] = createSignal(first.clock);
    const [loaded, setLoaded] = createSignal(first.loaded);
    const [scene, setScene] = createSignal(first);
    /** Whether the story threw, and how to try again. */
    let failure: { readonly retry: () => void } | undefined;
    let markDrawn = (): void => undefined;
    const drawn = new Promise<void>((resolve) => {
      markDrawn = resolve;
    });
    const view: StoryView = { texts, clock, globals: globals.record, loaded, scene };
    const context = liveContext(args.record, view, canvas);
    /** Says the story is drawn, once its effects ran without an error; a component of no output. */
    const Drawn = (): JSX.Element => {
      onMount(() => {
        if (failure === undefined) markDrawn();
      });
      return null;
    };
    /** The story on screen, made again only for another story. */
    const KeyedStory = (): JSX.Element =>
      Show({
        get when(): StoryDrawing {
          return scene();
        },
        keyed: true,
        children: (current: StoryDrawing): JSX.Element => [
          storyNode(current.story, context, current.decorators),
          createComponent(Drawn, {})
        ]
      });
    const dispose = render(
      () =>
        inProviders(texts, clock, () =>
          createComponent(ErrorBoundary, {
            fallback: (error: unknown, reset: () => void): JSX.Element => {
              if (failure === undefined) onError(toError(error));
              failure = { retry: reset };
              return null;
            },
            // read again after an error, so a try starts the story anew
            get children(): JSX.Element {
              return createComponent(Suspense, {
                get children(): JSX.Element {
                  // new args and switches reach the story in place
                  return createComponent(KeyedStory, {});
                }
              });
            }
          })
        ),
      canvas
    );
    return {
      drawn,
      update: (next: StoryDrawing): void => {
        args.assign(next.args);
        globals.assign(next.globals);
        setTexts(() => next.texts);
        setClock(() => next.clock);
        setLoaded(() => next.loaded);
        if (!isSameStory(scene(), next)) setScene(() => next);
        if (failure !== undefined) {
          const { retry } = failure;
          failure = undefined;
          retry();
        }
      },
      unmount: dispose
    };
  },
  renderToString: async (drawing: StoryDrawing): Promise<string> => {
    const context = storyContextOf(drawing, drawing.args, () => document.body);
    try {
      return await renderToStringAsync(() =>
        inProviders(
          () => drawing.texts,
          () => drawing.clock,
          () => storyNode(drawing.story, context, drawing.decorators)
        )
      );
    } catch (error) {
      throw toError(error);
    }
  }
};
