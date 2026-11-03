/**
 * Forgebook's renderer for a Next.js project, as the frame draws with it: React's frame renderer, each story given its
 * route and request, and its server components awaited before it is drawn (`serverComponents.ts`).
 *
 * @remarks
 * A story's route and request (`parameters.nextjs`) live in a store made when the story is mounted, so a story drawn
 * again with other args keeps where its links took it, and one that starts over starts at its own route. The store's
 * calls go to the catalogue's Events tab. Everything else is React's frame renderer
 * (`@forgebook/react/frame-renderer`), which this one wraps: the decorators, the texts and the clock, the error
 * boundary. The server render is in `nextRenderer.tsx`, which the frame page does not import.
 *
 * @module
 */
import { reactFrameRenderer } from "@forgebook/react/frame-renderer";
import type { StoryContext } from "@forgebook/story-format/csf";
import type { FrameRenderer, MountedStory, StoryDrawing } from "forgebook/renderer";
import type { LoadedArgs, LoadedDecorator, LoadedStory } from "forgebook/story-module";
import { type ReactNode, Suspense, useEffect } from "react";

import { createRouteStore, setCurrentStore } from "./routeStore.ts";
import {
  forgetServerResults,
  isAsyncComponent,
  isDrawable,
  serverComponentStandIn,
  withServerComponents
} from "./serverComponents.ts";

/** How many parts of the frame's stories are waiting (a server component, a `next/dynamic` module, a `use`). */
let waiting = 0;

/** What to call when nothing waits any more. */
const onSettled = new Set<() => void>();

/** What the story's boundary shows while a part waits: nothing, counted, so the story is drawn only once all came. */
const Waiting = (): ReactNode => {
  useEffect(() => {
    waiting += 1;
    return (): void => {
      waiting -= 1;
      if (waiting === 0) for (const settled of [...onSettled]) settled();
    };
  }, []);
  return null;
};

/** Resolves once no part of the frame's stories waits. */
const settled = (): Promise<void> =>
  new Promise((resolve) => {
    const check = (): void => {
      if (waiting > 0) return;
      onSettled.delete(check);
      resolve();
    };
    onSettled.add(check);
    check();
  });

/**
 * Calls back each time React puts the story in the page: its effect runs after every commit of the story, and not
 * when the story threw.
 *
 * @param props - the story, and what to call.
 */
const Committed = ({
  children,
  onCommit
}: {
  readonly children: ReactNode;
  readonly onCommit: () => void;
}): ReactNode => {
  useEffect(() => {
    onCommit();
  });
  return children;
};

/**
 * The decorator outside every other: what the catalogue's decorators return, its server components swapped for their
 * stand-ins, in a boundary that waits for them.
 *
 * @remarks
 * The frame draws a story at once (no part of it may wait outside a boundary), and counts it drawn when React put it
 * in the page: the boundary takes what waits, and the renderer's `drawn` waits until the boundary shows the story.
 * A server render (the generated tests) has no boundary: one would turn the story's error into an empty boundary, and
 * the test must see it fail.
 *
 * @param onCommit - what to call each time React put the story in the page; none on a server, with no boundary.
 * @returns the decorator.
 */
const serverComponentsDecorator =
  (onCommit: (() => void) | undefined): LoadedDecorator =>
  (story: () => unknown): unknown => {
    const tree = withServerComponents(story());
    const drawable = isDrawable(tree) ? tree : null;
    return onCommit === undefined ? (
      drawable
    ) : (
      <Committed onCommit={onCommit}>
        <Suspense fallback={<Waiting />}>{drawable}</Suspense>
      </Committed>
    );
  };

/**
 * The story React's renderer gets: an async component swapped for its stand-in, and what its render returns too.
 *
 * @param story - the story the frame loaded.
 */
const withServerStory = (story: LoadedStory): LoadedStory => {
  const { component, render } = story;
  return {
    ...story,
    component: isAsyncComponent(component) ? serverComponentStandIn(component) : component,
    render:
      render === undefined
        ? undefined
        : (args: LoadedArgs, context: StoryContext<LoadedArgs>): unknown =>
            withServerComponents(render(args, context))
  };
};

/**
 * The drawing React's renderer gets: the story's server components swapped, the Next.js decorator outside the
 * catalogue's. The server render (`nextRenderer.tsx`) gives its drawing the same way.
 *
 * @internal
 * @param drawing - the drawing the frame gave.
 * @param onCommit - what to call each time React put the story in the page; none on a server.
 */
export const withNext = (drawing: StoryDrawing, onCommit: (() => void) | undefined): StoryDrawing => ({
  ...drawing,
  story: withServerStory(drawing.story),
  decorators: [...drawing.decorators, serverComponentsDecorator(onCommit)]
});

/** React's frame renderer for a Next.js project. */
export const nextFrameRenderer: FrameRenderer = {
  mount: (canvas: HTMLElement, first: StoryDrawing, onError: (error: Error) => void): MountedStory => {
    setCurrentStore(createRouteStore(first.story.parameters, first.onEvent));
    forgetServerResults();
    let hasFailed = false;
    let markDrawn = (): void => undefined;
    const drawn = new Promise<void>((resolve) => {
      markDrawn = resolve;
    });
    // a drawing counts once nothing it waits for is left, unless it threw meanwhile (a server component that calls
    // `notFound`), as React's renderer does not count one that throws at once; new args are a new drawing, so a story
    // that threw is drawn when other args draw it
    const onCommit = (): void => {
      void settled().then(() => {
        if (!hasFailed) markDrawn();
      });
    };
    const mounted = reactFrameRenderer.mount(canvas, withNext(first, onCommit), (error: Error): void => {
      hasFailed = true;
      onError(error);
    });
    return {
      drawn,
      update: (next: StoryDrawing): void => {
        hasFailed = false;
        mounted.update(withNext(next, onCommit));
      },
      unmount: mounted.unmount
    };
  }
};
