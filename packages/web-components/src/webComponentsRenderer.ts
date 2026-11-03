/**
 * Forgebook's renderer for Web Components: draws a story in a canvas with Lit's `render`, inside the catalogue's
 * decorators, records the events its element dispatches, and hands the frame what the story or an element throws.
 *
 * @remarks
 * The frame runs everything else the same for every framework (`forgebook/renderer`): the play function, Replay, the
 * matrix, the error shown in place of the story.
 *
 * Drawing again calls the render again and hands Lit the result: Lit keeps every element a template drew before, so an
 * element keeps its own state while the panel changes the args, as it would in an app. A story with no render draws the
 * meta's element, made once and brought to each new set of args (`storyElement.ts`). The story clock ticks draw again,
 * so a render that reads `context.clock` follows it.
 *
 * An event arg (`@change`) is listened to on the canvas in the capture phase, so an element's event reaches it whether
 * it bubbles or not, and whether the story has a render or not: a render does not bind it. The listener reads the
 * moment's arg, which the frame wraps to record each call.
 *
 * Errors come three ways: a render or a decorator throws while it is called; an element throws in a callback the
 * browser runs while Lit inserts it, which the browser reports as a page error rather than throwing; a Lit element
 * throws in its update, which rejects its `updateComplete`. The story is drawn once every Lit element in it has updated.
 * After an error the story is drawn anew on the next change, with new elements: Lit reports an element's failed update
 * again on its next one.
 *
 * The server render is loaded by its package name when it is asked for (`serverRender.ts`): no bundler follows it, so
 * the page never meets Lit's server renderer, and only Node ever runs it.
 *
 * @module
 */
import type { MountedStory, StoryDrawing, StoryRenderer } from "forgebook/renderer";
import { storyContextOf } from "forgebook/renderer";
import { nothing, render } from "lit";

import { argTarget } from "./argNames.ts";
import { elementTag } from "./elementTag.ts";
import { storyContent } from "./storyContent.ts";
import { type StoryElement, storyElement } from "./storyElement.ts";

/** An error as the frame takes it. */
const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

/** How many rounds of Lit updates the renderer waits for: an element that updates its children starts another. */
const UPDATE_ROUNDS = 10;

/**
 * Every element under a root, inside the shadow roots too.
 *
 * @param root - the canvas, or a shadow root.
 */
const elementsUnder = (root: ParentNode): Element[] =>
  [...root.querySelectorAll("*")].flatMap((element) => [
    element,
    ...(element.shadowRoot === null ? [] : elementsUnder(element.shadowRoot))
  ]);

/**
 * The updates of the Lit elements under a root that are still to finish: each element's `updateComplete`, which
 * resolves to whether it settled, and rejects with what its update threw.
 *
 * @param root - the canvas.
 */
const pendingUpdates = (root: ParentNode): Promise<unknown>[] =>
  elementsUnder(root).flatMap((element) => {
    const isPending: unknown = Reflect.get(element, "isUpdatePending");
    const complete: unknown = Reflect.get(element, "updateComplete");
    return isPending === true && complete instanceof Promise ? [complete] : [];
  });

/**
 * Whether an element's first update threw: connected, its update over, never updated. Lit raises that error again,
 * unhandled, when the element is asked to update once more, so a story drawn again over it makes its elements anew.
 *
 * @param element - the story's element.
 */
const isBroken = (element: Element): boolean =>
  element.isConnected &&
  Reflect.get(element, "hasUpdated") === false &&
  Reflect.get(element, "isUpdatePending") === false;

/**
 * Waits until the Lit elements under a root have updated.
 *
 * @param root - the canvas.
 * @returns once they have; rejects with what an element's update threw.
 */
const settled = async (root: ParentNode): Promise<void> => {
  for (let round = 0; round < UPDATE_ROUNDS; round += 1) {
    const pending = pendingUpdates(root);
    if (pending.length === 0) return;
    await Promise.all(pending);
  }
};

/** The module of the server render, by the package's name: a name no bundler follows into the page. */
const SERVER_MODULE = "@forgebook/web-components/server";

/** What the server render module exports. */
type ServerModule = {
  /** The story's HTML. */
  readonly renderStoryToString: (drawing: StoryDrawing) => Promise<string>;
};

/**
 * Whether a module is the server render's.
 *
 * @param module - the module, as `import()` gave it.
 */
const isServerModule = (module: unknown): module is ServerModule =>
  typeof module === "object" &&
  module !== null &&
  "renderStoryToString" in module &&
  typeof module.renderStoryToString === "function";

/**
 * Loads the server render.
 *
 * @throws when it cannot load: without `@lit-labs/ssr`, which it imports, most of all.
 */
const serverModule = async (): Promise<ServerModule> => {
  let module: unknown;
  try {
    module = await import(/* @vite-ignore */ SERVER_MODULE);
  } catch (error) {
    throw new Error(
      "Drawing Web Components stories on a server needs @lit-labs/ssr: npm install --save-dev @lit-labs/ssr",
      { cause: error }
    );
  }
  if (!isServerModule(module)) throw new Error(`${SERVER_MODULE} exports no renderStoryToString`);
  return module;
};

/** Web Components as the frame draws them. */
export const webComponentsRenderer: StoryRenderer = {
  mount: (canvas: HTMLElement, first: StoryDrawing, onError: (error: Error) => void): MountedStory => {
    let current = first;
    let kept: StoryElement | undefined;
    let hasFailed = false;
    let isMounted = true;
    /** Grows at each draw, so a draw that settles late does not speak for a newer one. */
    let drawCount = 0;
    let markDrawn = (): void => undefined;
    const drawn = new Promise<void>((resolve) => {
      markDrawn = resolve;
    });
    const listeners = new Map<string, (event: Event) => void>();
    let stopClock = (): void => undefined;

    const fail = (error: unknown): void => {
      if (!hasFailed) onError(toError(error));
      hasFailed = true;
      render(nothing, canvas);
      kept = undefined;
    };

    /** The meta's element with the moment's args: the one made before, while its tag is the same. */
    const element = (): unknown => {
      const found = elementTag(current.story.component);
      if ("problem" in found) throw new Error(found.problem);
      if (kept?.element.localName !== found.tag) kept = storyElement(found.tag);
      kept.apply(current.args);
      return kept.element;
    };

    /** Listens to each event arg's event on the canvas, and to no other. */
    const listen = (): void => {
      const events = new Set(
        Object.keys(current.args).flatMap((name) => {
          const target = argTarget(name);
          return target.kind === "event" ? [name] : [];
        })
      );
      for (const [name, listener] of listeners) {
        if (events.has(name)) continue;
        canvas.removeEventListener(argTarget(name).name, listener, { capture: true });
        listeners.delete(name);
      }
      for (const name of events) {
        if (listeners.has(name)) continue;
        const listener = (event: Event): void => {
          const handler = current.args[name];
          if (typeof handler === "function") handler(event);
        };
        canvas.addEventListener(argTarget(name).name, listener, { capture: true });
        listeners.set(name, listener);
      }
    };

    const draw = (): void => {
      drawCount += 1;
      const thisDraw = drawCount;
      const context = storyContextOf(current, current.args, () => canvas);
      // what an element throws in a callback the browser runs while Lit inserts it is reported, not thrown
      let reported: unknown;
      const onPageError = (event: ErrorEvent): void => {
        reported ??= event.error ?? new Error(event.message);
      };
      if (elementsUnder(canvas).some(isBroken)) {
        render(nothing, canvas);
        kept = undefined;
      }
      const view = canvas.ownerDocument.defaultView;
      view?.addEventListener("error", onPageError);
      try {
        render(storyContent(current.story, context, current.decorators, element), canvas);
      } catch (error) {
        fail(error);
        return;
      } finally {
        view?.removeEventListener("error", onPageError);
      }
      if (reported !== undefined) {
        fail(reported);
        return;
      }
      settled(canvas).then(
        () => {
          if (isMounted && thisDraw === drawCount && !hasFailed) markDrawn();
        },
        (error: unknown) => {
          if (isMounted && thisDraw === drawCount) fail(error);
        }
      );
    };

    const followClock = (): void => {
      stopClock();
      stopClock = current.clock.subscribe(() => {
        if (!hasFailed) draw();
      });
    };

    listen();
    followClock();
    draw();
    return {
      drawn,
      update: (next: StoryDrawing): void => {
        const isNewClock = next.clock !== current.clock;
        current = next;
        listen();
        if (isNewClock) followClock();
        hasFailed = false;
        draw();
      },
      unmount: (): void => {
        isMounted = false;
        stopClock();
        for (const [name, listener] of listeners)
          canvas.removeEventListener(argTarget(name).name, listener, { capture: true });
        listeners.clear();
        render(nothing, canvas);
      }
    };
  },
  renderToString: async (drawing: StoryDrawing): Promise<string> => {
    const { renderStoryToString } = await serverModule();
    return renderStoryToString(drawing);
  }
};
