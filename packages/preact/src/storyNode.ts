/**
 * A story drawn as Preact: its render (or the meta's component) inside its decorators, the story's, the meta's and
 * the catalogue's (its preview's), in that order outward. The story's canvas and each cell of its matrix draw it the
 * same way.
 *
 * @remarks
 * What a decorator gets as its story is a component too, the same one for every drawing of a level (`storyAt`): a
 * decorator writes `<Story />` as often as `story()`, and a new function at each drawing would be a new component to
 * Preact, mounting the story afresh and losing its state whenever an arg changed. Since that story reads its level from
 * a context, a decorator calls it while it renders, as it would a hook: not from an event handler.
 *
 * @module
 */

import type { StoryContext } from "@forgebook/story-format/csf";
import type { LoadedArgs, LoadedDecorator, LoadedStory } from "forgebook/story-module";
import { type ComponentChildren, type ComponentType, createContext, h } from "preact";
import { useContext } from "preact/hooks";

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

/** What each level of decorators draws, innermost first, for the drawing being rendered. */
const LevelsContext = createContext<readonly (() => ComponentChildren)[]>([]);

/** The story a decorator gets at each level, made once and kept: a component's identity is what keeps its state. */
const levels: (() => ComponentChildren)[] = [];

/**
 * The story a decorator at a level gets: callable (`story()`) and a component (`<Story />`), the same function for every
 * drawing, which draws whatever its level holds in the drawing being rendered.
 *
 * @param level - the level, 0 for what the innermost decorator wraps.
 */
const storyAt = (level: number): (() => ComponentChildren) => {
  const known = levels[level];
  if (known !== undefined) return known;
  const story = (): ComponentChildren => useContext(LevelsContext)[level]?.() ?? null;
  levels[level] = story;
  return story;
};

/**
 * Where the outermost level draws, inside its levels' provider: a decorator calling `story()` reads them from there.
 *
 * @param props - what to draw.
 */
const StoryDraw = ({ draw }: { readonly draw: () => ComponentChildren }): ComponentChildren => draw();

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
  // each level draws the one inside it through that level's kept component
  const drawn: (() => ComponentChildren)[] = [renderStory];
  story.decorators.forEach((decorator, level) => {
    drawn.push((): ComponentChildren => decorator(storyAt(level), context));
  });
  return h(LevelsContext.Provider, { value: drawn }, h(StoryDraw, { draw: drawn.at(-1) ?? renderStory }));
};
