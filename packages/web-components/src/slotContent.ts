/**
 * The light DOM a story's slot args lay out in its element: the unnamed slot's content as it is, each named slot's in a
 * `<span slot="name">`, which is what the code writer writes too. The page draws it into the element, the server writes
 * it between the element's tags.
 *
 * @module
 */
import type { LoadedArgs } from "forgebook/story-module";
import { html, nothing } from "lit";

import { argTarget, DEFAULT_SLOT } from "./argNames.ts";

/**
 * What a slot's arg holds, as Lit draws it: a function is called for its content; nothing for a value that shows none.
 *
 * @param value - the arg's value.
 */
const slotValue = (value: unknown): unknown => {
  const content: unknown = typeof value === "function" ? Reflect.apply(value, undefined, []) : value;
  return content === undefined || content === null || content === false ? nothing : content;
};

/**
 * The content of the slots the args fill, in the order they are written.
 *
 * @param args - the story's args.
 */
export const slotsContent = (args: LoadedArgs): unknown[] =>
  Object.entries(args).flatMap(([name, value]) => {
    const target = argTarget(name);
    const content = target.kind === "slot" ? slotValue(value) : nothing;
    if (content === nothing) return [];
    return target.name === DEFAULT_SLOT ? [content] : [html`<span slot=${target.name}>${content}</span>`];
  });
