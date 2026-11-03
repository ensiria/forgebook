/**
 * A story drawn as Solid: its render (or the meta's component) inside its decorators, the story's, the meta's and
 * the catalogue's (its preview's), in that order outward. The story's canvas and each cell of its matrix draw it the
 * same way, in a page and on a server.
 *
 * @module
 */

import type { StoryContext } from "@forgebook/story-format/csf";
import type { LoadedArgs, LoadedDecorator, LoadedStory } from "forgebook/story-module";
import { createComponent, type JSX, untrack } from "solid-js";

/** A loaded story as Solid draws it: its component, render and decorators return Solid's output. */
type SolidStory = {
  /** The meta's component. */
  readonly component: ((props: LoadedArgs) => JSX.Element) | undefined;
  /** The story's render. */
  readonly render: ((args: LoadedArgs, context: StoryContext<LoadedArgs>) => JSX.Element) | undefined;
  /** The decorators, innermost first. */
  readonly decorators: readonly ((
    story: () => JSX.Element,
    context: StoryContext<LoadedArgs>
  ) => JSX.Element)[];
};

/**
 * A loaded story read as Solid's: the one place Solid's types meet the story file's module.
 *
 * @remarks
 * The frame reads a story file without its types (`forgebook/story-module`: a function is taken with the signature
 * CSF gives it), so what its functions return is `unknown` there. A Solid story file is written against
 * `@forgebook/solid`'s `Meta` and `Story`, and its catalogue's preview against its `Preview`, whose components,
 * renders and decorators return `JSX.Element`: that is what this view takes on trust, as the frame takes the
 * functions' parameters.
 *
 * @param story - the loaded story.
 */
const asSolidStory = (story: LoadedStory): SolidStory => story as SolidStory;

/**
 * The story with these args: its render (or the meta's component, with the args as its props), inside its
 * decorators. Each part runs once, as a Solid component does; what it reads of the args follows them.
 *
 * @param loaded - the story.
 * @param context - the args and the canvas its render, play and decorators read.
 * @param outer - the catalogue's decorators, outside the story's and the meta's.
 */
export const storyNode = (
  loaded: LoadedStory,
  context: StoryContext<LoadedArgs>,
  outer: readonly LoadedDecorator[]
): JSX.Element => {
  const story = asSolidStory({ ...loaded, decorators: [...loaded.decorators, ...outer] });
  const { component, render } = story;
  // each part runs untracked, as a component's body does: a decorator writing `{story()}` in its JSX calls it inside
  // an effect, which would otherwise make the whole story again whenever the render read an arg at its top level
  const renderStory = (): JSX.Element =>
    untrack(() => {
      if (render !== undefined) return render(context.args, context);
      // the args themselves are the props, not a copy: a component reads each one as it changes
      return component === undefined ? null : createComponent(component, context.args);
    });
  const decorated = story.decorators.reduce<() => JSX.Element>(
    (inner, decorator) => (): JSX.Element => untrack(() => decorator(inner, context)),
    renderStory
  );
  return decorated();
};
