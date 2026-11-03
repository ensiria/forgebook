/**
 * Forgebook's renderer for React: draws a story in a canvas with a React root of its own, inside the texts' and the
 * clock's providers and the catalogue's decorators, and catches what the story throws.
 *
 * @remarks
 * The frame runs everything else the same for every framework (`forgebook/renderer`): the play function, Replay, the
 * matrix, the error shown in place of the story. Drawing again with other args keeps the story's state; the frame
 * mounts it anew when a story must start over. React's server renderer loads only when a server test renders a story
 * (`renderToString`), so it never reaches a frame, where it would be a large part of the first load.
 *
 * @module
 */

import type { MountedStory, StoryDrawing, StoryRenderer } from "forgebook/renderer";
import { storyContextOf } from "forgebook/renderer";
import { type ReactNode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

import { StoryClockContext } from "./clock.ts";
import { StoryErrorBoundary } from "./StoryErrorBoundary.tsx";
import { storyElement } from "./storyElement.ts";
import { StoryTextsContext } from "./texts.ts";

/**
 * The story in the texts' and the clock's providers; the language's provider is a decorator of the catalogue's
 * preview, inside these.
 *
 * @param drawing - the story's texts and clock.
 * @param story - the story's element, to wrap.
 */
const inProviders = (drawing: StoryDrawing, story: ReactNode): ReactNode => (
  <StoryTextsContext.Provider value={drawing.texts}>
    <StoryClockContext.Provider value={drawing.clock}>{story}</StoryClockContext.Provider>
  </StoryTextsContext.Provider>
);

/**
 * The story, telling once that it is drawn: its effect runs after React put it in the page, and does not run when the
 * story threw.
 *
 * @param props - the story's element and what to call once it is drawn.
 */
const Drawn = ({
  children,
  onDrawn
}: {
  readonly children: ReactNode;
  readonly onDrawn: () => void;
}): ReactNode => {
  const drawnRef = useRef(onDrawn);
  useEffect(() => {
    drawnRef.current();
  }, []);
  return children;
};

/** React as the frame draws with it. */
export const reactRenderer: StoryRenderer = {
  mount: (canvas: HTMLElement, first: StoryDrawing, onError: (error: Error) => void): MountedStory => {
    const root = createRoot(canvas);
    let markDrawn = (): void => undefined;
    const drawn = new Promise<void>((resolve) => {
      markDrawn = resolve;
    });
    let drawing = first;
    const draw = (): void => {
      root.render(
        inProviders(
          drawing,
          // new args render the story again: a value that made it throw can be changed back
          <StoryErrorBoundary resetKey={drawing.args} onError={onError}>
            <Drawn onDrawn={markDrawn}>
              {storyElement(
                drawing.story,
                storyContextOf(drawing, drawing.args, () => canvas),
                drawing.decorators
              )}
            </Drawn>
          </StoryErrorBoundary>
        )
      );
    };
    draw();
    return {
      drawn,
      update: (next: StoryDrawing): void => {
        drawing = next;
        draw();
      },
      unmount: (): void => root.unmount()
    };
  },
  renderToString: async (drawing: StoryDrawing): Promise<string> => {
    const { renderToString } = await import("react-dom/server");
    const context = storyContextOf(drawing, drawing.args, () => document.body);
    return renderToString(inProviders(drawing, storyElement(drawing.story, context, drawing.decorators)));
  }
};
