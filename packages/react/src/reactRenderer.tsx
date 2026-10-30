/**
 * Forgebook's renderer for React: draws a story in a canvas with a React root of its own, inside the texts' and the
 * clock's providers and the shown language's, and catches what the story throws.
 *
 * @remarks
 * The frame runs everything else the same for every framework (`forgebook/renderer`): the play function, Replay, the
 * matrix, the error shown in place of the story. Drawing again with other args keeps the story's state; the frame
 * mounts it anew when a story must start over.
 *
 * @module
 */

import type { StoryContext } from "@forgebook/story-format/csf";
import { storyTextOf } from "@forgebook/story-format/texts";
import type { MountedStory, StoryDrawing, StoryRenderer } from "forgebook/renderer";
import { untracedStep } from "forgebook/renderer";
import type { LoadedArgs } from "forgebook/story-module";
import { type ReactNode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";

import { StoryClockContext } from "./clock";
import { StoryErrorBoundary } from "./StoryErrorBoundary";
import { storyElement } from "./storyElement";
import { StoryTextsContext } from "./texts";

/**
 * A story inside its language's provider.
 *
 * @remarks
 * A React catalogue's languages are `StoryLanguage`s of `@forgebook/react` (their provider returns `ReactNode`); the
 * frame passes them on unread, as the format's `StoryLanguage<unknown>`, so what the provider returns is taken back as
 * React's here, the one place it comes back.
 *
 * @param wrap - the language's provider.
 * @param story - the story.
 */
const languageWrapped = (wrap: NonNullable<StoryDrawing["wrap"]>, story: ReactNode): ReactNode =>
  wrap(story) as ReactNode;

/**
 * The story in the texts', clock's and language's providers.
 *
 * @param drawing - the story's texts, clock and language.
 * @param story - the story's element, to wrap.
 */
const inProviders = (drawing: StoryDrawing, story: ReactNode): ReactNode => {
  const inLanguage = drawing.wrap === undefined ? story : languageWrapped(drawing.wrap, story);
  return (
    <StoryTextsContext.Provider value={drawing.texts}>
      <StoryClockContext.Provider value={drawing.clock}>{inLanguage}</StoryClockContext.Provider>
    </StoryTextsContext.Provider>
  );
};

/**
 * What a render and a decorator receive.
 *
 * @param drawing - the story's args, texts and clock.
 * @param canvasOf - the element the story is drawn in, read only when a story asks for it: on the server there is
 *   none, and a story that reads it there fails as it would in a page rendered on the server.
 */
const contextOf = (drawing: StoryDrawing, canvasOf: () => HTMLElement): StoryContext<LoadedArgs> => ({
  args: drawing.args,
  step: untracedStep,
  text: storyTextOf(drawing.texts),
  clock: drawing.clock,
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
                contextOf(drawing, () => canvas)
              )}
            </Drawn>
          </StoryErrorBoundary>
        )
      );
    };
    draw();
    return {
      drawn,
      update: (args: LoadedArgs): void => {
        drawing = { ...drawing, args };
        draw();
      },
      unmount: (): void => root.unmount()
    };
  },
  renderToString: (drawing: StoryDrawing): string => {
    const context = contextOf(drawing, () => document.body);
    return renderToString(inProviders(drawing, storyElement(drawing.story, context)));
  }
};
