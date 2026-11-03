/**
 * The template of a story drawn from its args: the component with the values the story and the props panel set, as a
 * developer would write it in an Angular template, for the Code card.
 *
 * @remarks
 * The component is written by its selector (`ComponentDocs.selector`, which the shell passes as the component's name in
 * code): `<fb-badge>`, or `<button fbButton>` for an attribute selector. Bindings follow Angular's style: a text as a
 * static attribute (`label="New"`), anything else bound (`[count]="3"`, `[disabled]="true"`, `[tones]="['a', 'b']"`), a
 * named value by its name (`[icon]="IconFolder"`). Projected content goes between the tags: `#default` as its text, any
 * other in an element its selector matches (`<span icon>` for `[icon]`). Only the values that cross from the frame are
 * known (texts, numbers, booleans, `null`, lists of texts and numbers, named values): a function the story passes, an
 * output's handler, is left out. Pure: the shell loads it and no Angular.
 *
 * @module
 */
import { type ArgValue, isNamedArg, type PanelArgs } from "forgebook/messages";
import type { StoryCodeWriter } from "forgebook/renderer";

import { isBindingName } from "./bindingName.ts";
import { attributeText, isVoidElement, openingOf, selectorElement } from "./selectorElement.ts";
import { contentOfArg, DEFAULT_CONTENT } from "./slotArgs.ts";

/**
 * A text as a template's content holds it: a tag, an interpolation or a block it writes stays text (Angular reads `{`,
 * `}` and `@` as syntax).
 */
const contentText = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;")
    .replace(/@/g, "&#64;");

/** A value as a template expression inside a double-quoted attribute. */
const expression = (value: string | number): string => {
  if (typeof value === "number") return String(value);
  const quoted = value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");
  return `'${attributeText(quoted)}'`;
};

/** Whether a named value's name can be written as a template expression. */
const isIdentifier = (name: string): boolean => /^[A-Za-z_$][\w$]*$/.test(name);

/** One binding as a template writes it. */
const binding = (name: string, value: ArgValue): string => {
  // a text Angular would read as an interpolation is bound as the text it is
  if (typeof value === "string")
    return value.includes("{{") ? `[${name}]="${expression(value)}"` : `${name}="${attributeText(value)}"`;
  // a named value is written by its name, as the source's module exports it
  if (isNamedArg(value)) return isIdentifier(value.named) ? `[${name}]="${value.named}"` : `[${name}]="null"`;
  if (Array.isArray(value)) return `[${name}]="[${value.map(expression).join(", ")}]"`;
  return `[${name}]="${String(value)}"`;
};

/** The longest line the bindings stay on one line for, in characters. */
const ONE_LINE = 80;

/** Whether a value fills a content with something to show. */
const isShown = (value: ArgValue | undefined): value is ArgValue =>
  value !== undefined && value !== null && value !== false;

/** A content's value as a template writes it: a named value as its name, interpolated. */
const valueText = (value: ArgValue): string => {
  if (!isNamedArg(value)) return contentText(String(value));
  return isIdentifier(value.named) ? `{{ ${value.named} }}` : contentText(value.named);
};

/**
 * One projected content: the default as its text, any other in an element its selector matches.
 *
 * @param selector - the content's selector.
 * @param value - what fills it.
 */
const contentBlock = (selector: string, value: ArgValue): string => {
  if (selector === DEFAULT_CONTENT) return valueText(value);
  const element = selectorElement(selector);
  return `<${openingOf(element)}>${valueText(value)}</${element.tag}>`;
};

/**
 * What goes between the component's tags.
 *
 * @param contents - the args that fill a content, by the content's selector.
 */
const contentsText = (contents: readonly (readonly [string, ArgValue])[]): string | undefined => {
  const shown = contents.filter(([, value]) => isShown(value));
  if (shown.length === 0) return undefined;
  const [only] = shown;
  if (shown.length === 1 && only?.[0] === DEFAULT_CONTENT) return valueText(only[1]);
  return `\n${shown.map(([selector, value]) => `  ${contentBlock(selector, value)}`).join("\n")}\n`;
};

/**
 * A component's template with these args.
 *
 * @param component - the component's selector (`fb-badge`), or its name when it has none.
 * @param args - the values, in the order they are written.
 */
export const storyTemplate = (component: string, args: PanelArgs): string => {
  const element = selectorElement(component);
  const entries = Object.entries(args);
  // an arg that is not a name (one from a crafted address) is left out: the code shown is code to copy
  const bindings = entries
    .filter(([name]) => contentOfArg(name) === undefined && isBindingName(name))
    .map(([name, value]) => binding(name, value));
  const inner = contentsText(
    entries.flatMap(([name, value]): [string, ArgValue][] => {
      const content = contentOfArg(name);
      return content === undefined ? [] : [[content, value]];
    })
  );
  const head = openingOf(element);
  const oneLine = [head, ...bindings].join(" ");
  const isOneLine = oneLine.length + 2 <= ONE_LINE;
  const opening = isOneLine ? `<${oneLine}` : `<${head}\n${bindings.map((text) => `  ${text}`).join("\n")}\n`;
  if (isVoidElement(element)) return `${opening}${isOneLine ? " " : ""}/>`;
  return `${opening}>${inner ?? ""}</${element.tag}>`;
};

/** The code writer an Angular catalogue's shell writes a story's code with: the name the generated pages import. */
export const codeOf: StoryCodeWriter = storyTemplate;
