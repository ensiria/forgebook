/**
 * The template of a story drawn from its args: the component with the values the story and the props panel set, as a
 * developer would write it in a single-file component, for the Code card.
 *
 * @remarks
 * Attributes follow Vue's style guide: a prop in kebab-case, a text in quotes, a number, `null`, `false` or a list bound
 * (`:count="3"`, `:options="['a', 'b']"`), `true` the bare name, a named value by its name (`:icon="IconFolder"`). A slot
 * goes between the tags: `#default` as its text, any other in a `<template #name>`. Only the values that cross from the
 * frame are known (texts, numbers, booleans, `null`, lists of texts and numbers, named values): a function the story
 * passes is left out. Pure.
 *
 * @module
 */
import { type ArgValue, isNamedArg, type PanelArgs } from "forgebook/messages";
import type { StoryCodeWriter } from "forgebook/renderer";

import { slotOfArg } from "./slotArgs.ts";

/** A prop's name as a template writes it (`maxLength` → `max-length`). */
const kebab = (name: string): string => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** A text as a template's attribute holds it. */
const attributeText = (text: string): string => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** A text as a template's content holds it: a tag or an interpolation it writes stays text. */
const contentText = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\{\{/g, "&#123;&#123;");

/** A value as a JavaScript expression inside a double-quoted attribute. */
const expression = (value: string | number): string => {
  if (typeof value === "number") return String(value);
  const quoted = value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");
  return `'${attributeText(quoted)}'`;
};

/** One attribute as a template writes it. */
const attribute = (name: string, value: ArgValue): string => {
  const prop = kebab(name);
  if (value === true) return prop;
  if (typeof value === "string") return `${prop}="${attributeText(value)}"`;
  // a named value is written by its name, as the source's module exports it (`:icon="IconFolder"`)
  if (isNamedArg(value)) return `:${prop}="${value.named}"`;
  // a multiple choice's values, as the source writes a list
  if (Array.isArray(value)) return `:${prop}="[${value.map(expression).join(", ")}]"`;
  return `:${prop}="${String(value)}"`;
};

/** The longest line the attributes stay on one line for, in characters. */
const ONE_LINE = 80;

/** Whether a value fills a slot with something to show. */
const isShown = (value: ArgValue | undefined): value is ArgValue =>
  value !== undefined && value !== null && value !== false;

/** A slot's content as a template writes it: a named value as its component. */
const slotContent = (value: ArgValue): string =>
  isNamedArg(value) ? `<${value.named} />` : contentText(String(value));

/**
 * What goes between a component's tags.
 *
 * @param slots - the args that fill a slot, by the slot's name.
 */
const slotsText = (slots: readonly (readonly [string, ArgValue])[]): string | undefined => {
  const shown = slots.filter(([, value]) => isShown(value));
  if (shown.length === 0) return undefined;
  const [only] = shown;
  if (shown.length === 1 && only?.[0] === "default") return slotContent(only[1]);
  const blocks = shown.map(([name, value]) => `  <template #${name}>${slotContent(value)}</template>`);
  return `\n${blocks.join("\n")}\n`;
};

/**
 * A component's template with these args.
 *
 * @param component - the component's name (`IconTile`).
 * @param args - the values, in the order they are written.
 */
export const storyTemplate = (component: string, args: PanelArgs): string => {
  const entries = Object.entries(args);
  const attributes = entries
    .filter(([name]) => slotOfArg(name) === undefined)
    .map(([name, value]) => attribute(name, value));
  const inner = slotsText(
    entries.flatMap(([name, value]): [string, ArgValue][] => {
      const slot = slotOfArg(name);
      return slot === undefined ? [] : [[slot, value]];
    })
  );
  const oneLine = [component, ...attributes].join(" ");
  const isOneLine = oneLine.length + 2 <= ONE_LINE;
  const opening = isOneLine
    ? `<${oneLine}`
    : `<${component}\n${attributes.map((text) => `  ${text}`).join("\n")}\n`;
  if (inner === undefined) return `${opening}${isOneLine ? " " : ""}/>`;
  return `${opening}>${inner}</${component}>`;
};

/** The code writer a Vue catalogue's shell writes a story's code with: the name the generated pages import. */
export const codeOf: StoryCodeWriter = storyTemplate;
