/**
 * Forgebook's renderer for Angular: draws a story in a canvas in an application of its own, with the texts and the clock
 * provided and inside the catalogue's decorators, and hands the frame what the story throws.
 *
 * @remarks
 * The frame runs everything else the same for every framework (`forgebook/renderer`): the play function, Replay, the
 * matrix, the error shown in place of the story.
 *
 * Each story is an application (`createApplication`), so its `applicationConfig` providers are its own. A story of the
 * meta's component with nothing around it is the component itself (`createComponent`), its args set as inputs
 * (`setInput`), its outputs calling the args' handlers and its `#` args projected as text: no template is compiled, and
 * the page loads no compiler. A story with a template (written, or wrapped by a decorator) is a host component whose
 * template is compiled when it is drawn, which loads Angular's compiler on first use; its props are the host's fields,
 * as Storybook's Angular stories have them.
 *
 * New args keep the story's state: they are set on what is drawn, and its change detection runs. The story starts over
 * only when what it is compiled with changes (another template, other metadata, other application providers).
 *
 * Change detection is zoneless, Angular's default since version 21 (and provided on 20); a story that needs zone.js
 * imports it in the preview and provides `provideZoneChangeDetection()` in its `applicationConfig`.
 *
 * The server render is in `serverRender.ts`, imported when it is asked for: the page never loads it.
 *
 * @module
 */

import {
  type ApplicationRef,
  ChangeDetectorRef,
  type ComponentRef,
  createComponent,
  ErrorHandler,
  Injector,
  reflectComponentType,
  signal,
  type Type,
  type WritableSignal
} from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import type { StoryClock } from "@forgebook/story-format/clock";
import type { StoryTextTable } from "@forgebook/story-format/texts";
import type { MountedStory, StoryDrawing, StoryRenderer } from "forgebook/renderer";
import { storyContextOf } from "forgebook/renderer";

import { STORY_CLOCK } from "./clock.ts";
import { argOfContent } from "./slotArgs.ts";
import {
  applicationProviders,
  compiledHost,
  isSameShape,
  type StoryHost,
  type StoryShape,
  shapeOf,
  toError
} from "./storyHost.ts";
import { type ComposedStory, composedStory, isClass } from "./storyResult.ts";
import { STORY_TEXTS } from "./texts.ts";

/** What a story's application reads besides its args, each a signal its components follow. */
type StoryView = {
  /** The texts of the shown language. */
  readonly texts: WritableSignal<StoryTextTable>;
  /** The story's clock. */
  readonly clock: WritableSignal<StoryClock>;
};

/** A story drawn in its canvas. */
type DrawnStory = {
  /** What it was compiled with: other args keep it, another shape draws it anew. */
  readonly shape: StoryShape;
  /** Its application. */
  readonly app: ApplicationRef;
  /** Sets new props on what is drawn, and runs its change detection. */
  readonly setProps: (props: Readonly<Record<string, unknown>>) => void;
  /** Takes it away. */
  readonly destroy: () => void;
};

/** Whether a module is the server render's. */
const isServerRender = (
  module: unknown
): module is { readonly renderOnServer: (drawing: StoryDrawing) => Promise<string> } =>
  typeof module === "object" &&
  module !== null &&
  "renderOnServer" in module &&
  typeof module.renderOnServer === "function";

/** Whether a value is a handler an output calls. */
const isHandler = (value: unknown): value is (event: unknown) => void => typeof value === "function";

/** Whether a value can be subscribed to, as an output can. */
const isSubscribable = (
  value: unknown
): value is { readonly subscribe: (next: (event: unknown) => void) => unknown } =>
  typeof value === "object" &&
  value !== null &&
  "subscribe" in value &&
  typeof value.subscribe === "function";

/**
 * Draws the meta's component itself: its args set as inputs, its outputs calling the args' handlers, its `#` args
 * projected as text.
 *
 * @param app - the story's application.
 * @param canvas - the story's canvas.
 * @param component - the component; none throws, as the story then draws nothing.
 * @param composed - the story.
 */
const drawComponent = (
  app: ApplicationRef,
  canvas: HTMLElement,
  component: Type<unknown> | undefined,
  composed: ComposedStory
): Omit<DrawnStory, "shape" | "app"> => {
  // a story with no template is its component: `composedStory` gives one whenever it computed no template
  if (component === undefined) throw new Error("The story has neither a template nor a component");
  const mirror = reflectComponentType(component);
  if (mirror === null) throw new Error(`${component.name} is not a component`);
  let props = composed.result.props ?? {};
  const providers = [...(composed.result.moduleMetadata?.providers ?? [])];
  // the metadata's providers, as an element's above the component, as a template's host would give them
  const elementInjector =
    providers.length === 0 ? undefined : Injector.create({ providers, parent: app.injector });
  const contents = mirror.ngContentSelectors.map((selector) => {
    const value = props[argOfContent(selector)];
    return value === undefined ? undefined : document.createTextNode(String(value));
  });
  const ref: ComponentRef<unknown> = createComponent(component, {
    environmentInjector: app.injector,
    ...(elementInjector === undefined ? {} : { elementInjector }),
    projectableNodes: contents.map((node) => (node === undefined ? [] : [node]))
  });
  canvas.append(ref.location.nativeElement);
  app.attachView(ref.hostView);
  const instance = ref.instance;
  for (const output of mirror.outputs) {
    const emitter: unknown =
      typeof instance === "object" && instance !== null ? Reflect.get(instance, output.propName) : undefined;
    if (!isSubscribable(emitter)) continue;
    // the handler of the moment: the frame wraps a new one with each drawing
    emitter.subscribe((event: unknown): void => {
      const handler = props[output.templateName];
      if (isHandler(handler)) handler(event);
    });
  }
  const setProps = (next: Readonly<Record<string, unknown>>): void => {
    for (const input of mirror.inputs) {
      const value = next[input.templateName];
      // an input never set keeps its own default; one set before is set again, to `undefined` when it went away
      if (value !== undefined || props[input.templateName] !== undefined)
        ref.setInput(input.templateName, value);
    }
    mirror.ngContentSelectors.forEach((selector, index) => {
      const node = contents[index];
      if (node !== undefined) node.textContent = String(next[argOfContent(selector)] ?? "");
    });
    props = next;
    ref.changeDetectorRef.detectChanges();
  };
  const first = props;
  props = {};
  setProps(first);
  return {
    setProps,
    destroy: (): void => {
      ref.destroy();
      ref.location.nativeElement.remove();
    }
  };
};

/**
 * Draws a story whose template is compiled: a host whose fields are the props.
 *
 * @param app - the story's application.
 * @param canvas - the story's canvas.
 * @param composed - the story.
 * @param Host - the story's host, its template compiled.
 */
const drawTemplate = (
  app: ApplicationRef,
  canvas: HTMLElement,
  composed: ComposedStory,
  Host: StoryHost
): Omit<DrawnStory, "shape" | "app"> => {
  const ref = createComponent(Host, { environmentInjector: app.injector });
  canvas.append(ref.location.nativeElement);
  app.attachView(ref.hostView);
  // the host starts with the story's props (its constructor sets them)
  let props: Readonly<Record<string, unknown>> = composed.result.props ?? {};
  const setProps = (next: Readonly<Record<string, unknown>>): void => {
    for (const name of Object.keys(props)) if (!(name in next)) delete ref.instance[name];
    Object.assign(ref.instance, next);
    props = next;
    // components are checked on push by default (Angular 22): fields set from outside mark nothing, so the host's own
    // view is marked
    ref.injector.get(ChangeDetectorRef).markForCheck();
    ref.changeDetectorRef.detectChanges();
  };
  ref.changeDetectorRef.detectChanges();
  return {
    setProps,
    destroy: (): void => {
      ref.destroy();
      ref.location.nativeElement.remove();
    }
  };
};

/** Angular as the frame draws with it. */
export const angularRenderer: StoryRenderer = {
  mount: (canvas: HTMLElement, first: StoryDrawing, onError: (error: Error) => void): MountedStory => {
    const view: StoryView = { texts: signal(first.texts), clock: signal(first.clock) };
    let drawn: DrawnStory | undefined;
    let hasFailed = false;
    let isDrawn = false;
    let isUnmounted = false;
    let isBusy = false;
    /** Grows with each application, so an error from one taken away is not the story's of the moment. */
    let generation = 0;
    let latest = first;
    let queue: Promise<void> = Promise.resolve();
    let markDrawn = (): void => undefined;
    const whenDrawn = new Promise<void>((resolve) => {
      markDrawn = resolve;
    });
    /**
     * Fails the story: the frame hears of it once, unless the drawing that failed is no longer the latest.
     *
     * @param error - what the story threw.
     * @param drawing - the drawing that threw.
     */
    const fail = (error: unknown, drawing: StoryDrawing): void => {
      // a story taken away says nothing more: the frame may be showing another one in its place
      if (isUnmounted) return;
      // args that changed while a drawing was under way are drawn next, anew: its error is of args no longer shown, and
      // would stand over the story the frame shows once they are drawn
      if (!hasFailed && drawing === latest) onError(toError(error));
      hasFailed = true;
    };
    const takeAway = (): void => {
      drawn?.destroy();
      drawn?.app.destroy();
      drawn = undefined;
    };
    /** The story with a drawing's args, composed, and what it is compiled with. */
    const prepare = (
      drawing: StoryDrawing
    ): { readonly composed: ComposedStory; readonly shape: StoryShape } => {
      view.texts.set(drawing.texts);
      view.clock.set(drawing.clock);
      const context = storyContextOf(drawing, drawing.args, () => canvas);
      const composed = composedStory(drawing.story, context, drawing.decorators);
      return { composed, shape: shapeOf(composed) };
    };
    /**
     * Sets a drawing's props on what is drawn, when it is compiled the same way: at once, so the frame hears of an
     * error before its next drawing.
     *
     * @returns whether the drawing was set; when not, the story is drawn anew.
     */
    const setOnDrawn = (drawing: StoryDrawing): boolean => {
      if (drawn === undefined || hasFailed) return false;
      try {
        const { composed, shape } = prepare(drawing);
        if (!isSameShape(drawn.shape, shape)) return false;
        drawn.setProps(composed.result.props ?? {});
      } catch (error) {
        // the story stays as it was, and is drawn anew with the next args
        fail(error, drawing);
      }
      return true;
    };
    /**
     * A story's application, with the story drawn in it; none when the story was taken away while it started.
     *
     * @param drawing - the story.
     * @param errorHandler - the application's error handler.
     */
    const startStory = async (
      drawing: StoryDrawing,
      errorHandler: Type<ErrorHandler>
    ): Promise<DrawnStory | undefined> => {
      const { composed, shape } = prepare(drawing);
      const component = isClass(drawing.story.component) ? drawing.story.component : undefined;
      // the template is compiled first: what follows the last wait is drawn at once, or not at all once unmounted
      const Host =
        composed.component === undefined ? await compiledHost(composed.result, component) : undefined;
      const app = await createApplication({
        providers: [
          ...applicationProviders(composed.result),
          { provide: STORY_TEXTS, useValue: view.texts.asReadonly() },
          { provide: STORY_CLOCK, useValue: view.clock.asReadonly() },
          { provide: ErrorHandler, useClass: errorHandler }
        ]
      });
      if (isUnmounted) {
        app.destroy();
        return undefined;
      }
      try {
        const parts =
          Host === undefined
            ? drawComponent(app, canvas, composed.component, composed)
            : drawTemplate(app, canvas, composed, Host);
        return { shape, app, ...parts };
      } catch (error) {
        app.destroy();
        throw error;
      }
    };
    /** Draws a story anew, in an application of its own. */
    const drawAnew = async (drawing: StoryDrawing): Promise<void> => {
      takeAway();
      hasFailed = false;
      isDrawn = false;
      generation += 1;
      const own = generation;
      // an error Angular catches (a lifecycle hook, a scheduled change detection) fails a story still being drawn; once
      // drawn, the story stands, as an application does, and the error goes to the browser
      class StoryErrorHandler extends ErrorHandler {
        override handleError(error: unknown): void {
          if (own === generation && !isDrawn) fail(error, drawing);
          else super.handleError(error);
        }
      }
      try {
        drawn = await startStory(drawing, StoryErrorHandler);
        await drawn?.app.whenStable();
        if (isUnmounted) {
          takeAway();
          return;
        }
        if (drawn !== undefined && !hasFailed && own === generation) {
          isDrawn = true;
          markDrawn();
        }
      } catch (error) {
        takeAway();
        fail(error, drawing);
      }
    };
    const schedule = (drawing: StoryDrawing): void => {
      latest = drawing;
      if (!isBusy && setOnDrawn(drawing)) return;
      // a story drawn anew waits for the drawing before it (an application starts asynchronously); only the latest is
      // drawn
      queue = queue.then(async () => {
        if (latest !== drawing || isUnmounted) return;
        isBusy = true;
        try {
          if (!setOnDrawn(drawing)) await drawAnew(drawing);
        } finally {
          isBusy = false;
        }
      });
    };
    schedule(first);
    return {
      drawn: whenDrawn,
      update: schedule,
      unmount: (): void => {
        isUnmounted = true;
        takeAway();
      }
    };
  },
  renderToString: async (drawing: StoryDrawing): Promise<string> => {
    // beside this module, with its extension (`.ts` in the sources, `.js` once built), named by a variable: Vite follows
    // a written import into the page's build, and Angular's server render carries a DOM of its own the page never runs
    const file = `./serverRender${import.meta.url.slice(import.meta.url.lastIndexOf("."))}`;
    const server: unknown = await import(/* @vite-ignore */ new URL(file, import.meta.url).href);
    if (!isServerRender(server)) throw new Error("The Angular server render could not be loaded");
    return server.renderOnServer(drawing);
  }
};
