/**
 * The markup of a story drawn from its args: the component with the values the story and the props panel set, as a
 * developer would write it in a Svelte file, for the Code card.
 *
 * @remarks
 * Attributes are written as Svelte writes them: a text in quotes, or as an expression when it holds a brace or a quote
 * (`label={"a {b}"}`); a number, `null`, `false` or a list as an expression (`count={3}`, `options={["a", "b"]}`); `true`
 * the bare name; a named value by its name (`icon={IconFolder}`). A snippet's text goes between the tags: `#children` as
 * the content, any other in a `{#snippet name()}` block. Only the values that cross from the frame are known (texts,
 * numbers, booleans, `null`, lists of texts and numbers, named values): a function the story passes is left out. Pure.
 *
 * @module
 */
import { argExpression } from "forgebook/arg-expression";
import { type ArgValue, isNamedArg, type NamedArg, type PanelArgs } from "forgebook/messages";
import type { StoryCodeWriter } from "forgebook/renderer";

import { snippetOfArg } from "./snippetArgs.ts";

/** The snippet a component's content fills. */
const CHILDREN = "children";

/** The longest line the attributes stay on one line for, in characters. */
const ONE_LINE = 80;

/** A text that reads the same between quotes: no brace, which opens an expression, and nothing to escape. */
const isPlainText = (text: string): boolean => !/[{}"&\n]/.test(text);

/** A value as a JavaScript expression. */
const expression = (value: string | number): string => JSON.stringify(value);

/** One attribute as Svelte writes it. */
const attribute = (name: string, value: ArgValue): string => {
  if (value === true) return name;
  if (typeof value === "string")
    return isPlainText(value) ? `${name}="${value}"` : `${name}={${expression(value)}}`;
  // a named value is written by its name, as the source's module exports it (`icon={IconFolder}`)
  if (isNamedArg(value)) return `${name}={${value.named}}`;
  // a list or an object, as the source writes one; a number, `null` and `false` read as themselves
  return `${name}={${argExpression(value, { text: expression, named: (named: NamedArg): string => named.named })}}`;
};

/** A text as Svelte's markup holds it: a tag or an expression it writes stays text. */
const contentText = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");

/** Whether a value fills a snippet: a text or a number, which is all the renderer draws in one. */
const isShown = (value: ArgValue): value is string | number =>
  typeof value === "string" || typeof value === "number";

/** A snippet's content as markup. */
const snippetContent = (value: string | number): string => contentText(String(value));

/**
 * What goes between a component's tags: each named snippet in its block, then the content.
 *
 * @param snippets - the args that fill a snippet, by the snippet's name.
 */
const contentOf = (snippets: readonly (readonly [string, ArgValue])[]): string | undefined => {
  const shown = snippets.flatMap(([name, value]): [string, string | number][] =>
    isShown(value) ? [[name, value]] : []
  );
  if (shown.length === 0) return undefined;
  const [only] = shown;
  if (shown.length === 1 && only?.[0] === CHILDREN) return snippetContent(only[1]);
  const named = shown
    .filter(([name]) => name !== CHILDREN)
    .map(([name, value]) => `  {#snippet ${name}()}${snippetContent(value)}{/snippet}`);
  const children = shown
    .filter(([name]) => name === CHILDREN)
    .map(([, value]) => `  ${snippetContent(value)}`);
  return `\n${[...named, ...children].join("\n")}\n`;
};

/**
 * A component's markup with these args.
 *
 * @param component - the component's name (`IconTile`).
 * @param args - the values, in the order they are written.
 */
export const storyMarkup = (component: string, args: PanelArgs): string => {
  const entries = Object.entries(args);
  const attributes = entries
    .filter(([name]) => snippetOfArg(name) === undefined)
    .map(([name, value]) => attribute(name, value));
  const content = contentOf(
    entries.flatMap(([name, value]): [string, ArgValue][] => {
      const snippet = snippetOfArg(name);
      return snippet === undefined ? [] : [[snippet, value]];
    })
  );
  const oneLine = [component, ...attributes].join(" ");
  const isOneLine = oneLine.length + 2 <= ONE_LINE;
  const opening = isOneLine
    ? `<${oneLine}`
    : `<${component}\n${attributes.map((text) => `  ${text}`).join("\n")}\n`;
  if (content === undefined) return `${opening}${isOneLine ? " " : ""}/>`;
  return `${opening}>${content}</${component}>`;
};

/** The code writer a Svelte catalogue's shell writes a story's code with: the name the generated pages import. */
export const codeOf: StoryCodeWriter = storyMarkup;
