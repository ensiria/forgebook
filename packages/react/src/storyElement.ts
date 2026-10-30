/**
 * A story drawn as React: its render (or the meta's component) inside its decorators. The story's canvas and each
 * cell of its matrix draw it the same way.
 *
 * @module
 */

import type { StoryContext } from "@forgebook/story-format/csf";
import type { LoadedArgs, LoadedStory } from "forgebook/story-module";
import { createElement, type ReactNode } from "react";

/**
 * The story with these args: its render (or the meta's component), inside its decorators.
 *
 * @param story - the story.
 * @param context - the args and the canvas its render, play and decorators read.
 */
export const storyElement = (story: LoadedStory, context: StoryContext<LoadedArgs>): ReactNode => {
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
