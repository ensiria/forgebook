/**
 * What the frame draws a story with in React: a canvas with a React root of its own, inside the texts' and the clock's
 * providers and the catalogue's decorators, catching what the story throws.
 *
 * @remarks
 * The frame runs everything else the same for every framework (`forgebook/renderer`): the play function, Replay, the
 * matrix, the error shown in place of the story. Drawing again with other args keeps the story's state; the frame
 * mounts it anew when a story must start over. The server render lives apart (`reactRenderer.tsx`): React's server
 * renderer is a third of a first load, and a page never calls it.
 *
 * @module
 */

import type { StoryContext } from "@forgebook/story-format/csf";
import { storyTextOf } from "@forgebook/story-format/texts";
import type { FrameRenderer, MountedStory, StoryDrawing } from "forgebook/renderer";
import { untracedStep } from "forgebook/renderer";
import type { LoadedArgs } from "forgebook/story-module";
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
export const inProviders = (drawing: StoryDrawing, story: ReactNode): ReactNode => (
  <StoryTextsContext.Provider value={drawing.texts}>
    <StoryClockContext.Provider value={drawing.clock}>{story}</StoryClockContext.Provider>
  </StoryTextsContext.Provider>
);

/**
 * What a render and a decorator receive.
 *
 * @param drawing - the story's args, texts, clock and switches' values.
 * @param canvasOf - the element the story is drawn in, read only when a story asks for it: on the server there is
 *   none, and a story that reads it there fails as it would in a page rendered on the server.
 */
export const contextOf = (drawing: StoryDrawing, canvasOf: () => HTMLElement): StoryContext<LoadedArgs> => ({
  args: drawing.args,
  step: untracedStep,
  text: storyTextOf(drawing.texts),
  clock: drawing.clock,
  globals: drawing.globals,
  loaded: drawing.loaded,
  ...drawing.identity,
  parameters: drawing.story.parameters,
  get canvasElement(): HTMLElement {
    return canvasOf();
  }
});

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
export const reactFrameRenderer: FrameRenderer = {
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
                contextOf(drawing, () => canvas),
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
  }
};
