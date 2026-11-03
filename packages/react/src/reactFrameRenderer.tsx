/**
 * Forgebook's renderer for React, as the frame draws with it: a story in a canvas with a React root of its own, inside
 * the texts' and the clock's providers and the catalogue's decorators, catching what the story throws.
 *
 * @remarks
 * The frame runs everything else the same for every framework (`forgebook/renderer`): the play function, Replay, the
 * matrix, the error shown in place of the story. Drawing again with other args keeps the story's state; the frame
 * mounts it anew when a story must start over. The server render is in `reactRenderer.tsx` and nothing here imports
 * it, so React's server renderer never reaches a frame page: neither a static catalogue's files nor a first start's
 * pre-bundle.
 *
 * @module
 */

import type { FrameRenderer, MountedStory, StoryDrawing } from "forgebook/renderer";
import { storyContextOf } from "forgebook/renderer";
import { type ReactNode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

import { StoryErrorBoundary } from "./StoryErrorBoundary.tsx";
import { storyElement } from "./storyElement.ts";
import { inProviders } from "./storyProviders.tsx";

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
                storyContextOf(drawing, drawing.args, () => canvas),
                drawing.decorators,
                drawing.changeArgs
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
