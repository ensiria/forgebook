/**
 * A story as HTML draws it: its render, or the meta's function called with the args, inside its decorators, the
 * story's, the meta's and the catalogue's (its preview's), in that order outward. The page and the server compose it
 * the same way.
 *
 * @remarks
 * A render, a function and a decorator return an HTML string or a DOM node; a decorator's `story()` gives the inner one
 * as it was returned. Anything else is a mistake the story's author must see, so it is refused with what was returned,
 * where a page would show `undefined` or `[object Object]`. Free of the DOM until a node is asked about: the server
 * composes the same content.
 *
 * @module
 */
import type { StoryContext } from "@forgebook/story-format/csf";
import type { LoadedArgs, LoadedDecorator, LoadedStory } from "forgebook/story-module";

/** What a story drew: HTML, or a node. */
export type StoryResult = string | Node;

/**
 * Whether a value is a DOM node, in a page or under a simulated DOM; never on a server without one.
 *
 * @param value - what a story returned.
 */
export const isNode = (value: unknown): value is Node => typeof Node !== "undefined" && value instanceof Node;

/**
 * What a story returned, checked.
 *
 * @param value - what a render, a function or a decorator returned.
 * @param what - who returned it, for the error.
 * @throws when it is neither a text nor a node.
 */
const storyResultOf = (value: unknown, what: string): StoryResult => {
  if (typeof value === "string" || isNode(value)) return value;
  const shown =
    value === null || typeof value !== "object" ? String(value) : Object.prototype.toString.call(value);
  throw new Error(`${what} returned ${shown}: an HTML story draws an HTML string or a DOM node`);
};

/**
 * The story with these args: its render, or the meta's function, inside its decorators.
 *
 * @param loaded - the story.
 * @param context - the args, the canvas and the rest its render and its decorators read.
 * @param outer - the catalogue's decorators, outside the story's and the meta's.
 * @throws what the story throws, and when it has neither a render nor a function to call.
 */
export const storyContent = (
  loaded: LoadedStory,
  context: StoryContext<LoadedArgs>,
  outer: readonly LoadedDecorator[]
): StoryResult => {
  const renderStory = (): StoryResult => {
    if (loaded.render !== undefined) return storyResultOf(loaded.render(context.args, context), "The render");
    const { component } = loaded;
    if (typeof component !== "function")
      throw new Error(
        component === undefined
          ? "The story has no render, and its meta names no function to draw it with"
          : "The meta's component is not a function: an HTML story's component draws from its args"
      );
    return storyResultOf(component(context.args, context), "The meta's component");
  };
  const decorated = [...loaded.decorators, ...outer].reduce<() => StoryResult>(
    (inner, decorator) => (): StoryResult => storyResultOf(decorator(inner, context), "A decorator"),
    renderStory
  );
  return decorated();
};
