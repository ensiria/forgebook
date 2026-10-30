/**
 * A story drawn as React: its render (or the meta's component) inside its decorators. The story's canvas and each
 * cell of its matrix draw it the same way.
 *
 * @module
 */

import type { StoryContext } from "@forgebook/story-format/csf";
import type { LoadedArgs, LoadedStory } from "forgebook/story-module";
import { createElement, type FunctionComponent, type ReactNode } from "react";

/** A loaded story as React draws it: its component, render and decorators return React's output. */
type ReactStory = {
  /** The meta's component. */
  readonly component: FunctionComponent<LoadedArgs> | undefined;
  /** The story's render. */
  readonly render: ((args: LoadedArgs, context: StoryContext<LoadedArgs>) => ReactNode) | undefined;
  /** The decorators, innermost first. */
  readonly decorators: readonly ((story: () => ReactNode, context: StoryContext<LoadedArgs>) => ReactNode)[];
};

/**
 * A loaded story read as React's: the one place React's types meet the story file's module.
 *
 * @remarks
 * The frame reads a story file without its types (`forgebook/story-module`: a function is taken with the signature
 * CSF gives it), so what its functions return is `unknown` there. A React story file is written against
 * `@forgebook/react`'s `Meta` and `Story`, whose component, render and decorators return `ReactNode`: that is what
 * this view takes on trust, as the frame takes the functions' parameters.
 *
 * @param story - the loaded story.
 */
const asReactStory = (story: LoadedStory): ReactStory => story as ReactStory;

/**
 * The story with these args: its render (or the meta's component), inside its decorators.
 *
 * @param loaded - the story.
 * @param context - the args and the canvas its render, play and decorators read.
 */
export const storyElement = (loaded: LoadedStory, context: StoryContext<LoadedArgs>): ReactNode => {
  const story = asReactStory(loaded);
  const renderStory = (): ReactNode => {
    if (story.render !== undefined) return story.render(context.args, context);
    return story.component === undefined ? null : createElement(story.component, context.args);
  };
  const decorated = story.decorators.reduce<() => ReactNode>(
    (inner, decorator) => (): ReactNode => decorator(inner, context),
    renderStory
  );
  return decorated();
};
