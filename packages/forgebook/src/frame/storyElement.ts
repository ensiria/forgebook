/**
 * A story drawn with given args: its render (or the meta's component) inside its decorators, and the attribute that
 * forces its states. The story's root and each cell of its matrix draw it the same way.
 *
 * @module
 */

import type { StepFunction, StoryContext } from "@ensiria/story-format/csf";
import { createElement, type ReactNode } from "react";

import { FORCE_ATTRIBUTE } from "../vite/forcedStates";
import type { LoadedArgs, LoadedStory } from "./storyModule";

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

/**
 * The attribute that forces the story's states on its root, when it forces any.
 *
 * @param story - the story.
 */
export const forcedAttribute = (story: LoadedStory): Readonly<Record<string, string>> =>
  story.forceState.length > 0 ? { [FORCE_ATTRIBUTE]: story.forceState.join(" ") } : {};

/** The `step` a render and a decorator receive: outside a play there is no trace, so a step only runs its part. */
export const untracedStep: StepFunction = async (
  _label: string,
  run: () => Promise<void> | void
): Promise<void> => {
  await run();
};
