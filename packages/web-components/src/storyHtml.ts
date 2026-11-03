/**
 * The HTML of a story drawn from its args: the element with the values the story and the props panel set, as a page
 * writes it, for the Code card.
 *
 * @remarks
 * HTML carries attributes and light DOM, nothing else, so the code is what a page can paste. An attribute arg is written
 * as one: a text quoted, a number as its digits, `true` the bare name, `false` and `null` left out as HTML leaves a
 * boolean attribute out, a list as JSON (`items='["a","b"]'`, which Lit's `Array` converter reads). A slot goes between
 * the tags: `#default` as its text, any other in a `<span slot="name">`, as the renderer lays it out. What HTML cannot
 * write is left out: a property (`.items`), a listener (`@change`), and a named value, which is a script's, not a
 * page's. A custom element is never self-closing, so the closing tag is always written. Pure.
 *
 * @module
 */
import { type ArgValue, isNamedArg, type PanelArgs } from "forgebook/messages";
import type { StoryCodeWriter } from "forgebook/renderer";

import { argTarget, DEFAULT_SLOT, isAttributeName } from "./argNames.ts";

/** A text inside a double-quoted attribute. */
const attributeText = (text: string): string => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** A text between tags: a tag it writes stays text. */
const contentText = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * One attribute as HTML writes it, or none for a value HTML leaves out.
 *
 * @param name - the attribute's name.
 * @param value - its value.
 */
const attribute = (name: string, value: ArgValue): string | undefined => {
  if (value === false || value === null || isNamedArg(value) || !isAttributeName(name)) return undefined;
  if (value === true) return name;
  // a list as JSON in single quotes, so its own double quotes need no escaping
  if (Array.isArray(value))
    return `${name}='${JSON.stringify(value).replace(/&/g, "&amp;").replace(/'/g, "&#39;")}'`;
  return `${name}="${attributeText(String(value))}"`;
};

/** The longest line the attributes stay on one line for, in characters. */
const ONE_LINE = 80;

/**
 * A slot's content as HTML writes it: a text, or none for a value that shows nothing or that HTML cannot write.
 *
 * @param value - the slot's arg.
 */
const slotContent = (value: ArgValue): string | undefined => {
  if (value === null || value === false || isNamedArg(value)) return undefined;
  return contentText(Array.isArray(value) ? value.join(" ") : String(value));
};

/**
 * What goes between an element's tags.
 *
 * @param slots - the slots' contents, by the slot's name.
 */
const slotsText = (slots: readonly (readonly [string, string])[]): string | undefined => {
  if (slots.length === 0) return undefined;
  const [only] = slots;
  if (slots.length === 1 && only?.[0] === DEFAULT_SLOT) return only[1];
  const lines = slots.map(([name, content]) =>
    name === DEFAULT_SLOT ? `  ${content}` : `  <span slot="${attributeText(name)}">${content}</span>`
  );
  return `\n${lines.join("\n")}\n`;
};

/**
 * An element's HTML with these args.
 *
 * @param tag - the element's name (`my-button`).
 * @param args - the values, in the order they are written.
 */
export const storyHtml = (tag: string, args: PanelArgs): string => {
  const attributes: string[] = [];
  const slots: [string, string][] = [];
  for (const [name, value] of Object.entries(args)) {
    const target = argTarget(name);
    if (target.kind === "attribute") {
      const text = attribute(target.name, value);
      if (text !== undefined) attributes.push(text);
    } else if (target.kind === "slot") {
      const content = slotContent(value);
      if (content !== undefined) slots.push([target.name, content]);
    }
  }
  const inner = slotsText(slots) ?? "";
  const oneLine = [tag, ...attributes].join(" ");
  const opening =
    oneLine.length + 2 <= ONE_LINE
      ? `<${oneLine}>`
      : `<${tag}\n${attributes.map((text) => `  ${text}`).join("\n")}\n>`;
  return `${opening}${inner}</${tag}>`;
};

/** The code writer a Web Components catalogue's shell writes a story's code with: the name the generated pages import. */
export const codeOf: StoryCodeWriter = storyHtml;
