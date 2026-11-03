/**
 * A story drawn as Preact: its render (or the meta's component) inside its decorators, the story's, the meta's and
 * the catalogue's (its preview's), in that order outward. The story's canvas and each cell of its matrix draw it the
 * same way.
 *
 * @module
 */

import type { StoryContext } from "@forgebook/story-format/csf";
import type { LoadedArgs, LoadedDecorator, LoadedStory } from "forgebook/story-module";
import { type ComponentChildren, type ComponentType, h } from "preact";

/** A loaded story as Preact draws it: its component, render and decorators return Preact's output. */
type PreactStory = {
  /** The meta's component: a function or a class. */
  readonly component: ComponentType<LoadedArgs> | undefined;
  /** The story's render. */
  readonly render: ((args: LoadedArgs, context: StoryContext<LoadedArgs>) => ComponentChildren) | undefined;
  /** The decorators, innermost first. */
  readonly decorators: readonly ((
    story: () => ComponentChildren,
    context: StoryContext<LoadedArgs>
  ) => ComponentChildren)[];
};

/**
 * A loaded story read as Preact's: the one place Preact's types meet the story file's module.
 *
 * @remarks
 * The frame reads a story file without its types (`forgebook/story-module`: a function is taken with the signature
 * CSF gives it), so what its functions return is `unknown` there. A Preact story file is written against
 * `@forgebook/preact`'s `Meta` and `Story`, and its catalogue's preview against its `Preview`, whose components,
 * renders and decorators return `ComponentChildren`: that is what this view takes on trust, as the frame takes the
 * functions' parameters.
 *
 * @param story - the loaded story.
 */
const asPreactStory = (story: LoadedStory): PreactStory => story as PreactStory;

/**
 * The story with these args: its render (or the meta's component), inside its decorators.
 *
 * @param loaded - the story.
 * @param context - the args and the canvas its render, play and decorators read.
 * @param outer - the catalogue's decorators, outside the story's and the meta's.
 */
export const storyNode = (
  loaded: LoadedStory,
  context: StoryContext<LoadedArgs>,
  outer: readonly LoadedDecorator[]
): ComponentChildren => {
  const story = asPreactStory({ ...loaded, decorators: [...loaded.decorators, ...outer] });
  const renderStory = (): ComponentChildren => {
    if (story.render !== undefined) return story.render(context.args, context);
    return story.component === undefined ? null : h(story.component, context.args);
  };
  const decorated = story.decorators.reduce<() => ComponentChildren>(
    (inner, decorator) => (): ComponentChildren => decorator(inner, context),
    renderStory
  );
  return decorated();
};
