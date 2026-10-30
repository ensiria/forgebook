/**
 * A renderer for stories whose render returns a DOM element: the smallest second framework, so the frame's tests prove
 * the contract (`src/frame/renderer.ts`) holds for something other than React.
 *
 * @module
 */
import type { StoryContext } from "@forgebook/story-format/csf";
import { storyTextOf } from "@forgebook/story-format/texts";

import {
  type MountedStory,
  type StoryDrawing,
  type StoryRenderer,
  untracedStep
} from "../src/frame/renderer";
import type { LoadedArgs } from "../src/frame/storyModule";

/**
 * The story's element for a drawing.
 *
 * @param drawing - the story and its args.
 * @param canvas - the element it is drawn in.
 * @throws when the story's render throws, or returns something that is not an element.
 */
const elementOf = (drawing: StoryDrawing, canvas: HTMLElement): HTMLElement => {
  const context: StoryContext<LoadedArgs> = {
    args: drawing.args,
    step: untracedStep,
    text: storyTextOf(drawing.texts),
    clock: drawing.clock,
    globals: drawing.globals,
    loaded: drawing.loaded,
    ...drawing.identity,
    parameters: drawing.story.parameters,
    canvasElement: canvas
  };
  const drawn: unknown = drawing.story.render?.(drawing.args, context);
  if (!(drawn instanceof HTMLElement)) throw new Error("A DOM story's render returns an element");
  return drawn;
};

/** Plain DOM as a framework. */
export const domRenderer: StoryRenderer = {
  mount: (canvas: HTMLElement, first: StoryDrawing, onError: (error: Error) => void): MountedStory => {
    let markDrawn = (): void => undefined;
    const drawn = new Promise<void>((resolve) => {
      markDrawn = resolve;
    });
    let drawing = first;
    const draw = (): void => {
      try {
        canvas.replaceChildren(elementOf(drawing, canvas));
        markDrawn();
      } catch (error) {
        canvas.replaceChildren();
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    };
    draw();
    return {
      drawn,
      update: (next: StoryDrawing): void => {
        drawing = next;
        draw();
      },
      unmount: (): void => canvas.replaceChildren()
    };
  },
  renderToString: (drawing: StoryDrawing): string => elementOf(drawing, document.body).outerHTML
};
