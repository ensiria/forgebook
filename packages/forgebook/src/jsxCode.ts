/**
 * The JSX of a story drawn from its args: the component with the values the story and the props panel set, as a
 * developer would write it, for the Code card. The code writer of every framework written in JSX (React, Preact,
 * Solid): each one's `./code` module hands it to the shell.
 *
 * @remarks
 * A text is an attribute in quotes (in braces when it holds a quote), a number or `null` in braces, `true` the bare
 * name, `false` in braces, a named value by its name (`icon={IconFolder}`), a list or an object as a literal
 * (`options={["weekly", "monthly"]}`); `children` goes between the tags. Only plain data and named values cross from
 * the frame: a function, an element or other code the story file writes comes as written (`written`), in braces
 * (`onClick={fn()}`), an element between the tags as it is, and is written over its value. Pure.
 *
 * @module
 */
import { argExpression } from "./argExpression.ts";
import type { StoryCodeWriter } from "./frame/renderer.ts";
import { type ArgValue, isNamedArg, type NamedArg, type PanelArgs } from "./messages.ts";

/** One attribute as JSX writes it. */
const attribute = (name: string, value: ArgValue): string => {
  if (value === true) return name;
  if (typeof value === "string")
    return value.includes('"') ? `${name}={${JSON.stringify(value)}}` : `${name}="${value}"`;
  // a named value is written by its name, as the source's module exports it (`icon={IconFolder}`)
  if (isNamedArg(value)) return `${name}={${value.named}}`;
  // a list or an object, as the source writes one; `null`, a number and `false` read as themselves
  const expression = argExpression(value, {
    text: (text: string): string => JSON.stringify(text),
    named: (named: NamedArg): string => named.named
  });
  return `${name}={${expression}}`;
};

/** The longest line the attributes stay on one line for, in characters. */
const ONE_LINE = 80;

/** Code that spans lines, its lines past the first indented by one level, for a place one level in. */
const indented = (text: string): string => text.replace(/\n/g, "\n  ");

/** What goes between the tags, when something does: written code (an element as it is), else the value as text. */
const childrenOf = (args: PanelArgs, written: Readonly<Record<string, string>>): string | undefined => {
  const code = written["children"];
  if (code !== undefined) return code.startsWith("<") ? code : `{${code}}`;
  const { children } = args;
  return children === undefined || children === null || children === false ? undefined : String(children);
};

/**
 * A component's JSX with these args.
 *
 * @param component - the component's name (`IconTile`).
 * @param args - the values, in the order they are written.
 * @param written - the args the story file writes as code, each as written; after the values in the order.
 */
export const jsxCode: StoryCodeWriter = (
  component: string,
  args: PanelArgs,
  written: Readonly<Record<string, string>> = {}
): string => {
  const names = [...new Set([...Object.keys(args), ...Object.keys(written)])].filter(
    (name) => name !== "children"
  );
  const attributes = names.flatMap((name): string[] => {
    const code = written[name];
    if (code !== undefined) return [`${name}={${code}}`];
    const value = args[name];
    return value === undefined ? [] : [attribute(name, value)];
  });
  const inner = childrenOf(args, written);
  const oneLine = [component, ...attributes].join(" ");
  const isOneLine = oneLine.length + 2 <= ONE_LINE && !oneLine.includes("\n");
  const opening = isOneLine
    ? `<${oneLine}`
    : `<${component}\n${attributes.map((text) => `  ${indented(text)}`).join("\n")}\n`;
  if (inner === undefined) return `${opening}${isOneLine ? " " : ""}/>`;
  if (inner.includes("\n")) return `${opening}>\n  ${indented(inner)}\n</${component}>`;
  return `${opening}>${inner}</${component}>`;
};
