/**
 * A story drawn as React: its render (or the meta's component) inside its decorators, the story's, the meta's and
 * the catalogue's (its preview's), in that order outward. The story's canvas and each cell of its matrix draw it the
 * same way.
 *
 * @remarks
 * The render and the decorators run inside components (`StoryDraw`, and the kept `storyAt` of each level), never while
 * the element is built: Storybook's users write hooks in both, and a hook outside a render throws. The components are
 * module-level functions, so new args draw the same components again and the story keeps its state; another story is
 * another key, so it starts over. Since a decorator's story reads its level from a context, a decorator calls it while
 * it renders, as it would a hook: not from an event handler, and not in another React root.
 *
 * What a decorator gets as its story is a component too, the same one for every drawing of a level (`storyAt`): a
 * decorator writes `<Story />` as often as `story()`, and a new function at each drawing would be a new component to
 * React, mounting the story afresh and losing its state whenever an arg changed.
 *
 * Each decorator and the render are called with the context Storybook's preview hooks read (`storybookHooks.ts`), so
 * a story file written for Storybook (`useArgs` in a decorator) runs as it does there.
 *
 * @module
 */

import type { StoryContext } from "@forgebook/story-format/csf";
import type { ArgsChange } from "forgebook/renderer";
import type { LoadedArgs, LoadedDecorator, LoadedStory } from "forgebook/story-module";
import { createContext, createElement, type ElementType, type ReactNode, useContext } from "react";

import { type StoryHooksContext, withStoryHooks } from "./storybookHooks.ts";

/** A loaded story as React draws it: its component, render and decorators return React's output. */
type ReactStory = {
  /** The meta's component: a function, a class, or what `memo` and `forwardRef` make. */
  readonly component: ElementType<LoadedArgs> | undefined;
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
 * `@forgebook/react`'s `Meta` and `Story`, and its catalogue's preview against its `Preview`, whose components,
 * renders and decorators return `ReactNode`: that is what this view takes on trust, as the frame takes the functions'
 * parameters.
 *
 * @param story - the loaded story.
 */
const asReactStory = (story: LoadedStory): ReactStory => story as ReactStory;

/** What each level of decorators draws, innermost first, for the drawing being rendered. */
const LevelsContext = createContext<readonly (() => ReactNode)[]>([]);

/** The story a decorator gets at each level, made once and kept: a component's identity is what keeps its state. */
const levels: (() => ReactNode)[] = [];

/**
 * The story a decorator at a level gets: callable (`story()`) and a component (`<Story />`), the same function for every
 * drawing, which draws whatever its level holds in the drawing being rendered.
 *
 * @param level - the level, 0 for what the innermost decorator wraps.
 */
const storyAt = (level: number): (() => ReactNode) => {
  const known = levels[level];
  if (known !== undefined) return known;
  const story = (): ReactNode => useContext(LevelsContext)[level]?.() ?? null;
  levels[level] = story;
  return story;
};

/**
 * Where the outermost level draws, inside its levels' provider: a decorator calling `story()` reads them from there.
 *
 * @param props - what to draw.
 */
const StoryDraw = ({ draw }: { readonly draw: () => ReactNode }): ReactNode => draw();

/**
 * The component a story draws in: where its render's and its decorators' hooks run.
 *
 * @param props - the story's render, inside its decorators.
 */
const StoryBody = ({
  draw,
  levels: drawn
}: {
  readonly draw: () => ReactNode;
  readonly levels: readonly (() => ReactNode)[];
}): ReactNode => createElement(LevelsContext.Provider, { value: drawn }, createElement(StoryDraw, { draw }));

/**
 * The story with these args: its render (or the meta's component), inside its decorators.
 *
 * @param loaded - the story.
 * @param context - the args and the canvas its render, play and decorators read.
 * @param outer - the catalogue's decorators, outside the story's and the meta's.
 * @param changeArgs - changes the story's args from its own code (Storybook's `useArgs`); none changes nothing.
 */
export const storyElement = (
  loaded: LoadedStory,
  context: StoryContext<LoadedArgs>,
  outer: readonly LoadedDecorator[],
  changeArgs: (change: ArgsChange) => void = (): undefined => undefined
): ReactNode => {
  const story = asReactStory({ ...loaded, decorators: [...loaded.decorators, ...outer] });
  const hooks: StoryHooksContext = {
    id: context.id,
    args: context.args,
    globals: context.globals,
    parameters: context.parameters,
    context,
    changeArgs
  };
  const renderStory = (): ReactNode =>
    withStoryHooks(hooks, (): ReactNode => {
      if (story.render !== undefined) return story.render(context.args, context);
      return story.component === undefined ? null : createElement(story.component, context.args);
    });
  // each level draws the one inside it through that level's kept component
  const drawn: (() => ReactNode)[] = [renderStory];
  story.decorators.forEach((decorator, level) => {
    drawn.push((): ReactNode => withStoryHooks(hooks, (): ReactNode => decorator(storyAt(level), context)));
  });
  return createElement(StoryBody, { key: context.id, draw: drawn.at(-1) ?? renderStory, levels: drawn });
};
