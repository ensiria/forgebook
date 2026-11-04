/**
 * A story as Lit draws it: its render (or the meta's element) inside its decorators, the story's, the meta's and the
 * catalogue's (its preview's), in that order outward. The page and the server draw it the same way, each with its own
 * element.
 *
 * @remarks
 * A render and a decorator return what Storybook's Web Components stories return: a Lit template, a DOM node, or a text,
 * which is HTML (`"<my-button></my-button>"`), the story's own markup. A decorator's `story()` gives the inner content,
 * which a template takes as a value (`html` with `${story()}` inside). Free of the DOM: the server composes the same
 * content, with an element written as a template instead of a node.
 *
 * @module
 */
import type { StoryContext } from "@forgebook/story-format/csf";
import type { LoadedArgs, LoadedDecorator, LoadedStory } from "forgebook/story-module";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

/**
 * What a render or a decorator returned, as Lit's `render` takes it: a text as HTML, anything else as it is.
 *
 * @param result - the template, node, text or nothing it returned.
 */
const asContent = (result: unknown): unknown => (typeof result === "string" ? unsafeHTML(result) : result);

/**
 * The story with these args: its render, or the meta's element, inside its decorators.
 *
 * @param loaded - the story.
 * @param context - the args, the canvas and the rest its render and its decorators read.
 * @param outer - the catalogue's decorators, outside the story's and the meta's.
 * @param element - the meta's element with the args, for a story with no render: a node in the page, a template on the
 *   server.
 */
export const storyContent = (
  loaded: LoadedStory,
  context: StoryContext<LoadedArgs>,
  outer: readonly LoadedDecorator[],
  element: () => unknown
): unknown => {
  const renderStory = (): unknown =>
    loaded.render === undefined ? element() : asContent(loaded.render(context.args, context));
  const decorated = [...loaded.decorators, ...outer].reduce<() => unknown>(
    (inner, decorator) => (): unknown => asContent(decorator(inner, context)),
    renderStory
  );
  return decorated();
};
