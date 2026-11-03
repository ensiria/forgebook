/**
 * A story drawn as Vue: its render (or the meta's component) inside its decorators, the story's, the meta's and the
 * catalogue's (its preview's), in that order outward. The story's canvas, each cell of its matrix and the server draw
 * it the same way.
 *
 * @remarks
 * A render and a decorator may return what CSF's Vue stories return: a virtual node (`h(Badge, args)`) or a component
 * (`{ components: { Badge }, setup: () => ({ args }), template: "…" }`), as Storybook's do. A decorator's `story()` is
 * always a virtual node, and a function, so it reads both as a value (`h("div", story())`) and as a component
 * (`{ components: { story }, template: "<div><story /></div>" }`).
 *
 * @module
 */
import type { StoryContext } from "@forgebook/story-format/csf";
import type { LoadedArgs, LoadedDecorator, LoadedStory } from "forgebook/story-module";
import { type Component, createCommentVNode, createTextVNode, Fragment, h, isVNode, type VNode } from "vue";

import { slotOfArg } from "./slotArgs.ts";

/** Whether a value can be drawn as a component: a function, or an options object. */
const isComponent = (value: unknown): value is Component =>
  typeof value === "function" || (typeof value === "object" && value !== null);

/**
 * What a render or a decorator returned, as one virtual node.
 *
 * @param result - the virtual node, the component, the text or nothing it returned.
 */
const asVNode = (result: unknown): VNode => {
  if (isVNode(result)) return result;
  if (typeof result === "string" || typeof result === "number") return createTextVNode(String(result));
  if (Array.isArray(result)) return h(Fragment, result.map(asVNode));
  return isComponent(result) ? h(result) : createCommentVNode();
};

/**
 * The meta's component with these args: its slots from the args that fill one, its props and listeners from the rest.
 *
 * @param component - the component.
 * @param args - the args.
 */
const componentVNode = (component: Component, args: LoadedArgs): VNode => {
  const props: Record<string, unknown> = {};
  const slots: Record<string, (scope: unknown) => unknown> = {};
  for (const [name, value] of Object.entries(args)) {
    const slot = slotOfArg(name);
    if (slot === undefined) props[name] = value;
    else if (value !== undefined)
      slots[slot] = (scope: unknown): unknown => (typeof value === "function" ? value(scope) : value);
  }
  return h(component, props, slots);
};

/**
 * The story with these args: its render (or the meta's component), inside its decorators.
 *
 * @param loaded - the story.
 * @param context - the args and the canvas its render, play and decorators read.
 * @param outer - the catalogue's decorators, outside the story's and the meta's.
 */
export const storyVNode = (
  loaded: LoadedStory,
  context: StoryContext<LoadedArgs>,
  outer: readonly LoadedDecorator[]
): VNode => {
  const renderStory = (): VNode => {
    if (loaded.render !== undefined) return asVNode(loaded.render(context.args, context));
    return isComponent(loaded.component)
      ? componentVNode(loaded.component, context.args)
      : createCommentVNode();
  };
  const decorated = [...loaded.decorators, ...outer].reduce<() => VNode>(
    (inner, decorator) => (): VNode => asVNode(decorator(inner, context)),
    renderStory
  );
  return decorated();
};
