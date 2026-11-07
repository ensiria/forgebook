/**
 * Forgebook's renderer for Vue: draws a story in a canvas with a Vue app of its own, with the texts and the clock
 * provided and inside the catalogue's decorators, and catches what the story throws.
 *
 * @remarks
 * The frame runs everything else the same for every framework (`forgebook/renderer`): the play function, Replay, the
 * matrix, the error shown in place of the story.
 *
 * New args go into one reactive object rather than a new render: a story written as a component reads
 * `setup: () => ({ args })` once, and calling its render again would make a new component each time, and start the
 * story over. The rest of what a story reads (the language, the switches, the clock) is reactive too, each on its own: a
 * render is called again only for what it read, so drawing again keeps the state of a story written as a component.
 *
 * A `Suspense` around the story waits for an `async setup` (a `<script setup>` with a top-level `await`), and the frame's
 * wait (`settled`, `vnodeContent.ts`) covers it as it covers a story's own `Suspense`, so the frame's play function finds
 * the story drawn.
 *
 * The server render is imported when it is asked for: the page never loads it, and only Node ever runs it.
 *
 * A framework built on Vue (Nuxt) needs each story's app before it is drawn, to install what its components read (a
 * router, its own state): `createVueRenderer` takes a `prepareApp` for that, and `vueRenderer` is the renderer without
 * one.
 *
 * @module
 */
import type { StoryClock } from "@forgebook/story-format/clock";
import type { StoryContext } from "@forgebook/story-format/csf";
import { type StoryTextFunction, type StoryTextTable, storyTextOf } from "@forgebook/story-format/texts";
import type { MountedStory, StoryDrawing, StoryRenderer } from "forgebook/renderer";
import { contentSettled, storyContextOf, untracedStep } from "forgebook/renderer";
import type { LoadedArgs } from "forgebook/story-module";
import {
  type App,
  computed,
  createApp,
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  onErrorCaptured,
  type Ref,
  ref,
  Suspense,
  shallowReactive,
  shallowRef
} from "vue";

import { STORY_CLOCK } from "./clock.ts";
import { storyVNode } from "./storyVnode.ts";
import { STORY_TEXTS } from "./texts.ts";
import { checkedContent, contentOfCanvas, SETTLED } from "./vnodeContent.ts";

/**
 * What Vue says of an error in an event handler: its words in development, its error code's page in production. Such an
 * error is the handler's: the story stands, as in a page, and it goes to the browser as any other.
 */
const HANDLER_ERROR = /event handler|#runtime-[56]$/;

/** An error as the frame takes it. */
const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

/**
 * Provides what the story's composables read.
 *
 * @param app - the story's app.
 * @param texts - the shown language's texts.
 * @param clock - the story's clock.
 */
const provideDrawing = (
  app: App,
  texts: Readonly<Ref<StoryTextTable>>,
  clock: Readonly<Ref<StoryClock>>
): void => {
  app.provide(STORY_TEXTS, texts);
  app.provide(STORY_CLOCK, clock);
};

/** What a story reads besides its args, each followed on its own. */
type StoryView = { -readonly [TField in "texts" | "clock" | "globals" | "loaded"]: StoryDrawing[TField] };

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
 * @param args - the reactive args.
 * @param view - the reactive view.
 * @param scene - the drawing on screen.
 * @param canvas - the story's canvas.
 */
const liveContext = (
  args: LoadedArgs,
  view: StoryView,
  scene: Readonly<Ref<StoryDrawing>>,
  canvas: HTMLElement
): StoryContext<LoadedArgs> => ({
  args,
  step: untracedStep,
  canvasElement: canvas,
  get text(): StoryTextFunction {
    return storyTextOf(view.texts);
  },
  get clock(): StoryClock {
    return view.clock;
  },
  get globals(): StoryView["globals"] {
    return view.globals;
  },
  get loaded(): StoryView["loaded"] {
    return view.loaded;
  },
  get id(): string {
    return scene.value.identity.id;
  },
  get name(): string {
    return scene.value.identity.name;
  },
  get title(): string {
    return scene.value.identity.title;
  },
  get parameters(): Readonly<Record<string, unknown>> {
    return scene.value.story.parameters;
  }
});

/**
 * Brings the view to a new drawing's values, leaving alone what did not change.
 *
 * @param view - the reactive view.
 * @param next - the new drawing.
 */
const assignView = (view: StoryView, next: StoryDrawing): void => {
  if (JSON.stringify(view.globals) !== JSON.stringify(next.globals)) view.globals = next.globals;
  view.texts = next.texts;
  view.clock = next.clock;
  view.loaded = next.loaded;
};

/**
 * Makes the reactive args equal to new ones, so what reads them follows.
 *
 * @param args - the reactive args.
 * @param next - the new values.
 */
const assignArgs = (args: Record<string, unknown>, next: LoadedArgs): void => {
  for (const name of Object.keys(args)) if (!(name in next)) delete args[name];
  Object.assign(args, next);
};

/** What a framework built on Vue adds to its renderer. */
export type VueRendererOptions = {
  /**
   * Called with each story's app before it is mounted, or rendered on the server, with the story's first drawing and
   * where it is drawn: it installs what the story's components read (a router) and provides values. None by default.
   * The app is the story's until the story is mounted anew, so what it installs is the story's own.
   */
  readonly prepareApp?: (app: App, drawing: StoryDrawing, place: "page" | "server") => void;
};

/**
 * Vue as the frame draws with it, with what a framework built on Vue adds.
 *
 * @param options - what is done to each story's app; nothing by default.
 * @returns the renderer.
 */
export const createVueRenderer = (options: VueRendererOptions = {}): StoryRenderer => ({
  mount: (canvas: HTMLElement, first: StoryDrawing, onError: (error: Error) => void): MountedStory => {
    const args = shallowReactive<Record<string, unknown>>({ ...first.args });
    const scene = shallowRef(first);
    const view = shallowReactive<StoryView>({
      texts: first.texts,
      clock: first.clock,
      globals: first.globals,
      loaded: first.loaded
    });
    const hasFailed = ref(false);
    /** Grows at each new try after an error, so the story is mounted anew. */
    const attempt = ref(0);
    let markDrawn = (): void => undefined;
    const drawn = new Promise<void>((resolve) => {
      markDrawn = resolve;
    });
    const context = liveContext(args, view, scene, canvas);
    const Story = defineComponent({
      name: "ForgebookStory",
      setup: () => () => storyVNode(scene.value.story, context, scene.value.decorators)
    });
    // after the flush that runs `onMounted`: a story that throws there is not drawn
    const markWhenFlushed = (): void => {
      void nextTick().then(() => {
        if (!hasFailed.value) markDrawn();
      });
    };
    const Boundary = defineComponent({
      name: "ForgebookBoundary",
      setup: () => {
        onErrorCaptured((error: unknown, _instance: unknown, info: string): false | undefined => {
          if (HANDLER_ERROR.test(info)) return undefined;
          if (!hasFailed.value) onError(toError(error));
          hasFailed.value = true;
          return false;
        });
        return () =>
          hasFailed.value
            ? null
            : h(
                Suspense,
                { onResolve: markWhenFlushed },
                { default: () => h(Story, { key: attempt.value }) }
              );
      }
    });
    const app = createApp(Boundary);
    provideDrawing(
      app,
      computed(() => view.texts),
      computed(() => view.clock)
    );
    options.prepareApp?.(app, first, "page");
    app.mount(canvas);
    // a story meant to stay in its fallback is drawn as it is: what it awaits is not coming
    if (first.story.suspense.isExpected) markWhenFlushed();
    let isGone = false;
    return {
      drawn,
      settled: async (timeout: number) =>
        checkedContent(
          await contentSettled(() => (isGone ? SETTLED : contentOfCanvas(canvas)), timeout),
          isGone
        ),
      update: (next: StoryDrawing): void => {
        assignArgs(args, next.args);
        assignView(view, next);
        if (!isSameStory(scene.value, next)) scene.value = next;
        if (hasFailed.value) {
          attempt.value += 1;
          hasFailed.value = false;
        }
      },
      unmount: (): void => {
        isGone = true;
        app.unmount();
      }
    };
  },
  renderToString: async (drawing: StoryDrawing): Promise<string> => {
    const { renderToString } = await import("vue/server-renderer");
    const context = storyContextOf(drawing, drawing.args, () => document.body);
    const app = createSSRApp({ render: () => storyVNode(drawing.story, context, drawing.decorators) });
    provideDrawing(app, shallowRef(drawing.texts), shallowRef(drawing.clock));
    options.prepareApp?.(app, drawing, "server");
    // the server keeps going after a render error, with an empty comment in its place: without this it would not fail
    const failures: unknown[] = [];
    app.config.errorHandler = (error: unknown): void => {
      failures.push(error);
    };
    const html = await renderToString(app);
    const [failure] = failures;
    if (failure !== undefined) throw toError(failure);
    return html;
  }
});

/** Vue as the frame draws with it. */
export const vueRenderer: StoryRenderer = createVueRenderer();
