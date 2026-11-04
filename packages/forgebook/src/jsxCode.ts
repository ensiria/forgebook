/**
 * The JSX of a story drawn from its args: the component with the values the story and the props panel set, as a
 * developer would write it, for the Code card. The code writer of every framework written in JSX (React, Preact,
 * Solid): each one's `./code` module hands it to the shell.
 *
 * @remarks
 * A text is an attribute in quotes (in braces when it holds a quote), a number or `null` in braces, `true` the bare
 * name, `false` in braces, a named value by its name (`icon={IconFolder}`), a list as an array literal
 * (`options={["weekly", "monthly"]}`); `children` goes between the tags. Only the values that cross from the frame are
 * known (texts, numbers, booleans, `null`, lists of texts and numbers, named values): a function or an element the
 * story passes is left out. Pure.
 *
 * @module
 */
import type { StoryCodeWriter } from "./frame/renderer.ts";
import { type ArgValue, isNamedArg, type PanelArgs } from "./messages.ts";

/** One attribute as JSX writes it. */
const attribute = (name: string, value: ArgValue): string => {
  if (value === true) return name;
  if (typeof value === "string")
    return value.includes('"') ? `${name}={${JSON.stringify(value)}}` : `${name}="${value}"`;
  // a named value is written by its name, as the source's module exports it (`icon={IconFolder}`)
  if (isNamedArg(value)) return `${name}={${value.named}}`;
  // a multiple choice's values, as the source writes a list
  if (Array.isArray(value)) return `${name}={[${value.map((item) => JSON.stringify(item)).join(", ")}]}`;
  return `${name}={${String(value)}}`;
};

/** The longest line the attributes stay on one line for, in characters. */
const ONE_LINE = 80;

/**
 * A component's JSX with these args.
 *
 * @param component - the component's name (`IconTile`).
 * @param args - the values, in the order they are written.
 */
export const jsxCode: StoryCodeWriter = (component: string, args: PanelArgs): string => {
  const { children, ...rest } = args;
  const attributes = Object.entries(rest).map(([name, value]) => attribute(name, value));
  const inner =
    children === undefined || children === null || children === false ? undefined : String(children);
  const oneLine = [component, ...attributes].join(" ");
  const isOneLine = oneLine.length + 2 <= ONE_LINE;
  const opening = isOneLine
    ? `<${oneLine}`
    : `<${component}\n${attributes.map((text) => `  ${text}`).join("\n")}\n`;
  if (inner === undefined) return `${opening}${isOneLine ? " " : ""}/>`;
  return `${opening}>${inner}</${component}>`;
};
