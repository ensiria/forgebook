/**
 * Forgebook's renderer for Preact: draws a story in a canvas with Preact itself, inside the texts' and the clock's
 * providers and the catalogue's decorators, and catches what the story throws.
 *
 * @remarks
 * The frame runs everything else the same for every framework (`forgebook/renderer`): the play function, Replay, the
 * matrix, the error shown in place of the story. Drawing again with other args renders the same tree again, which
 * Preact diffs, so the story keeps its state; the frame mounts it anew when a story must start over.
 *
 * The stories are drawn by Preact, not by React's renderer over `preact/compat`: the catalogue's shell is React and
 * shares the page's Vite server, so aliasing `react` to `preact/compat` would move the shell too, and a Preact
 * library's types (`ComponentChildren`, its JSX) would not meet React's. A story's hooks, signals and context are
 * Preact's own.
 *
 * The story's render runs inside a component of its own, as Storybook runs it: a render may call hooks, and what it
 * throws reaches the boundary.
 *
 * The server render is imported when it is asked for: the page never loads it, and only Node ever runs it. It waits for
 * what a story suspends on (`lazy`, a thrown promise), as a page does.
 *
 * @module
 */

import type { MountedStory, StoryDrawing, StoryRenderer } from "forgebook/renderer";
import { storyContextOf } from "forgebook/renderer";
import { type ComponentChildren, render, type VNode } from "preact";
import { useEffect, useRef } from "preact/hooks";

import { StoryClockContext } from "./clock.ts";
import { StoryErrorBoundary } from "./StoryErrorBoundary.ts";
import { storyNode } from "./storyNode.ts";
import { StoryTextsContext } from "./texts.ts";

/**
 * The story in the texts' and the clock's providers; the language's provider is a decorator of the catalogue's
 * preview, inside these.
 *
 * @param drawing - the story's texts and clock.
 * @param story - the story's nodes, to wrap.
 */
const inProviders = (drawing: StoryDrawing, story: ComponentChildren): VNode => (
  <StoryTextsContext.Provider value={drawing.texts}>
    <StoryClockContext.Provider value={drawing.clock}>{story}</StoryClockContext.Provider>
  </StoryTextsContext.Provider>
);

/**
 * The story: its render inside its decorators, run as a component's, so the hooks a render calls are this component's.
 *
 * @param props - the drawing, and the story's canvas (read only when the story asks for it).
 */
const StoryBody = ({
  drawing,
  canvasOf
}: {
  readonly drawing: StoryDrawing;
  readonly canvasOf: () => HTMLElement;
}): ComponentChildren =>
  storyNode(drawing.story, storyContextOf(drawing, drawing.args, canvasOf), drawing.decorators);

/**
 * The story, telling once that it is drawn: its effect runs after Preact put it in the page, and does not run when the
 * story threw.
 *
 * @param props - the story's nodes and what to call once it is drawn.
 */
const Drawn = ({
  children,
  onDrawn
}: {
  readonly children: ComponentChildren;
  readonly onDrawn: () => void;
}): ComponentChildren => {
  const drawnRef = useRef(onDrawn);
  useEffect(() => {
    drawnRef.current();
  }, []);
  return children;
};

/** An error as the frame takes it. */
const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

/** Preact as the frame draws with it. */
export const preactRenderer: StoryRenderer = {
  mount: (canvas: HTMLElement, first: StoryDrawing, onError: (error: Error) => void): MountedStory => {
    let markDrawn = (): void => undefined;
    const drawn = new Promise<void>((resolve) => {
      markDrawn = resolve;
    });
    const draw = (drawing: StoryDrawing): void => {
      render(
        inProviders(
          drawing,
          // new args render the story again: a value that made it throw can be changed back
          <StoryErrorBoundary resetKey={drawing.args} onError={onError}>
            <Drawn onDrawn={markDrawn}>
              {/* another story starts over: its hooks are not this one's */}
              <StoryBody key={drawing.identity.id} drawing={drawing} canvasOf={() => canvas} />
            </Drawn>
          </StoryErrorBoundary>
        ),
        canvas
      );
    };
    draw(first);
    return {
      drawn,
      update: draw,
      unmount: (): void => render(null, canvas)
    };
  },
  renderToString: async (drawing: StoryDrawing): Promise<string> => {
    const { renderToStringAsync } = await import("preact-render-to-string");
    try {
      return await renderToStringAsync(
        inProviders(drawing, <StoryBody drawing={drawing} canvasOf={() => document.body} />)
      );
    } catch (error) {
      throw toError(error);
    }
  }
};
