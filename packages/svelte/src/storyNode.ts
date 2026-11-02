/**
 * A story as Svelte draws it: its render (or the meta's component) inside its decorators, the story's, the meta's and the
 * catalogue's (its preview's), in that order outward, as a tree of components with their props. The story's canvas, each
 * cell of its matrix and the server draw it the same way, through `StoryHost.svelte`.
 *
 * @remarks
 * Svelte has no function that draws a component from code, so the tree is data and the host's template draws it: each
 * node's component with its props, the node inside it as its `children`. A render returns a component, drawn with the
 * args, or `{ Component, props }`, as Storybook's Svelte stories do; a decorator returns the same, drawn around the story.
 * A decorator's `story()` gives the story's node: one that returns it as it is adds nothing around it. A `#name` prop
 * becomes the snippet of its text (`snippetArgs.ts`).
 *
 * @module
 */
import type { StoryContext } from "@forgebook/story-format/csf";
import type { LoadedArgs, LoadedDecorator, LoadedStory } from "forgebook/story-module";
import type { Component } from "svelte";

import { snippetOfArg } from "./snippetArgs.ts";
import type { TextSnippets } from "./textSnippet.ts";

/** A component as the host draws it: with whatever props the story gives. */
export type DrawnComponent = Component<Record<string, unknown>>;

/** One component of a story's tree, with its props and what it draws inside. */
export type StoryNode = {
  /** The component. */
  readonly component: DrawnComponent;
  /** Its props, the snippets of `#name` texts made. */
  readonly props: Readonly<Record<string, unknown>>;
  /** What it draws as its `children`: the story inside a decorator; none for the story itself. */
  readonly inner?: StoryNode;
};

/** Whether a value is a component: Svelte 5 compiles every component to a function. */
const isComponent = (value: unknown): value is DrawnComponent => typeof value === "function";

/** Whether a value is an object of props. */
const isProps = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Props with each `#name` text as its snippet; a `#name` with nothing to show sets nothing.
 *
 * @param props - the props, as the args or a render give them.
 * @param snippetOf - makes a text's snippet.
 */
const withSnippets = (
  props: Readonly<Record<string, unknown>>,
  snippetOf: TextSnippets
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(props).flatMap(([name, value]): [string, unknown][] => {
      const snippet = snippetOfArg(name);
      if (snippet === undefined) return [[name, value]];
      if (value === undefined || value === null || value === false) return [];
      if (typeof value !== "string" && typeof value !== "number")
        throw new Error(`${name} takes a text, which its snippet draws; pass a snippet as ${snippet}`);
      return [[snippet, snippetOf(snippet, String(value))]];
    })
  );

/**
 * What a render or a decorator returned, as a node.
 *
 * @param result - the component, or the component with props.
 * @param props - the props a bare component is drawn with.
 * @param snippetOf - makes a text's snippet.
 * @param who - what returned it, for the error.
 * @throws when it is neither, which the frame shows in place of the story.
 */
const nodeOf = (
  result: unknown,
  props: Readonly<Record<string, unknown>>,
  snippetOf: TextSnippets,
  who: string
): StoryNode => {
  if (isComponent(result)) return { component: result, props: withSnippets(props, snippetOf) };
  // `{ Component, props }`, as Storybook's Svelte stories write it
  if (isProps(result) && isComponent(result["Component"])) {
    const chosen = result["props"];
    return { component: result["Component"], props: withSnippets(isProps(chosen) ? chosen : {}, snippetOf) };
  }
  throw new Error(`${who} returned neither a component nor { Component, props }`);
};

/**
 * The story with these args: its render (or the meta's component), inside its decorators.
 *
 * @param loaded - the story.
 * @param context - the args and the canvas its render, play and decorators read.
 * @param outer - the catalogue's decorators, outside the story's and the meta's.
 * @param snippetOf - makes the snippet of a `#name` text.
 * @throws when the story has nothing to draw, or a render or a decorator returns what cannot be drawn.
 */
export const storyNode = (
  loaded: LoadedStory,
  context: StoryContext<LoadedArgs>,
  outer: readonly LoadedDecorator[],
  snippetOf: TextSnippets
): StoryNode => {
  const { args } = context;
  const story = (): StoryNode => {
    if (loaded.render !== undefined) return nodeOf(loaded.render(args, context), args, snippetOf, "A render");
    if (loaded.component !== undefined)
      return nodeOf(loaded.component, args, snippetOf, "The meta's component");
    throw new Error("The story has neither a render nor a component to draw");
  };
  return [...loaded.decorators, ...outer].reduce<StoryNode>((inner, decorator) => {
    const result = decorator(() => inner, context);
    // a decorator that only reads the context, or sets one, returns the story as it was given
    if (result === inner) return inner;
    return { ...nodeOf(result, {}, snippetOf, "A decorator"), inner };
  }, story());
};
