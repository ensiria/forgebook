/**
 * The element an Angular selector matches, as a template writes it: `fb-badge` is `<fb-badge>`, `button[fbButton]` is
 * `<button fbButton>`, `[fbTooltip]` a `<div fbTooltip>`, as Angular itself makes a host for a selector with no element.
 *
 * @remarks
 * Shared by the renderer, which writes a component story's template, and the code writer, which runs in the shell and
 * loads no Angular, so it reads the selector's text alone. Only the first selector of a list is read (`a, button` is
 * `<a>`), and a `:not(…)` matches nothing to write. Pure.
 *
 * @module
 */

/** An element a selector matches. */
export type SelectorElement = {
  /** Its tag: the selector's, or `div` when the selector names none. */
  readonly tag: string;
  /** Its attributes, in the selector's order: a name, and the value the selector asks for when it asks for one. */
  readonly attributes: readonly (readonly [string, string | undefined])[];
  /** Its classes, in the selector's order. */
  readonly classes: readonly string[];
};

/** The tag Angular gives a host whose selector names no element. */
const DEFAULT_TAG = "div";

/** One part of a selector: a tag, an attribute (`[name]`, `[name=value]`) or a class. */
const PART = /^(?:([A-Za-z][\w-]*)|\[([^\]=\s]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]|\.([\w-]+))/;

/**
 * The first selector of a list: a comma inside brackets or parentheses does not end it.
 *
 * @param selector - the selector, as the component's decorator writes it.
 */
const firstSelector = (selector: string): string => {
  let depth = 0;
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    if (character === "[" || character === "(") depth += 1;
    else if (character === "]" || character === ")") depth -= 1;
    else if (character === "," && depth === 0) return selector.slice(0, index);
  }
  return selector;
};

/**
 * The element a selector matches.
 *
 * @param selector - the selector, as the component's decorator writes it.
 */
export const selectorElement = (selector: string): SelectorElement => {
  let rest = firstSelector(selector)
    .replace(/:not\([^)]*\)/g, "")
    .trim();
  let tag: string | undefined;
  const attributes: [string, string | undefined][] = [];
  const classes: string[] = [];
  while (rest !== "") {
    const match = PART.exec(rest);
    if (match === null) break;
    const [whole, name, attribute, doubleQuoted, singleQuoted, bare, className] = match;
    if (name !== undefined) tag = name;
    else if (attribute !== undefined)
      attributes.push([attribute, doubleQuoted ?? singleQuoted ?? bare?.trim()]);
    else if (className !== undefined) classes.push(className);
    rest = rest.slice(whole.length);
  }
  return { tag: tag ?? DEFAULT_TAG, attributes, classes };
};

/** A text as an attribute's value holds it. */
export const attributeText = (text: string): string => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/**
 * The opening tag's name and the attributes a selector asks for (`button fbButton`), without the brackets, so a writer
 * adds its own bindings after them.
 *
 * @param element - the element.
 */
export const openingOf = (element: SelectorElement): string =>
  [
    element.tag,
    ...element.attributes.map(([name, value]) =>
      value === undefined ? name : `${name}="${attributeText(value)}"`
    ),
    ...(element.classes.length === 0 ? [] : [`class="${element.classes.join(" ")}"`])
  ].join(" ");

/** The elements that have no closing tag, which a template writes as `<input … />`. */
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr"
]);

/** Whether an element has no content and no closing tag (`input`). */
export const isVoidElement = (element: SelectorElement): boolean => VOID_ELEMENTS.has(element.tag);
