/**
 * The code of a story drawn from its args: the call of the meta's function with the values the story and the props
 * panel set, as a page's script writes it, for the Code tab and Show code.
 *
 * @remarks
 * An HTML story's component is a function that returns HTML or a node (`createButton(args)`), so what a person copies
 * to draw the same thing is that call, written as JavaScript: the args as an object literal, a text quoted, a list as
 * a list, a named value by its name, as the source's module exports it. A story with a render of its own shows its
 * render instead, as written in its file. Pure.
 *
 * @module
 */
import { type ArgValue, isNamedArg, type PanelArgs } from "forgebook/messages";
import type { StoryCodeWriter } from "forgebook/renderer";

/** A name JavaScript writes bare: as a key, or a value by its name. */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** The longest call written on one line, in characters. */
const ONE_LINE = 80;

/**
 * A key of the args' object: bare when it is a name, quoted otherwise.
 *
 * @param name - the arg's name.
 */
const keyText = (name: string): string => (IDENTIFIER.test(name) ? name : JSON.stringify(name));

/**
 * A value as JavaScript writes it.
 *
 * @param value - the arg's value.
 */
const valueText = (value: ArgValue): string => {
  // a named value is written by its name, as the source's module exports it (`icon: starIcon`)
  if (isNamedArg(value)) return IDENTIFIER.test(value.named) ? value.named : JSON.stringify(value.named);
  if (Array.isArray(value)) return `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
  return JSON.stringify(value);
};

/**
 * The call of a story's function with these args.
 *
 * @param name - the function's name (`createButton`), as its docs name it.
 * @param args - the values, in the order they are written.
 */
export const storyCall = (name: string, args: PanelArgs): string => {
  const entries = Object.entries(args).map(([key, value]) => `${keyText(key)}: ${valueText(value)}`);
  if (entries.length === 0) return `${name}()`;
  const oneLine = `${name}({ ${entries.join(", ")} })`;
  if (oneLine.length <= ONE_LINE) return oneLine;
  return `${name}({\n${entries.map((entry) => `  ${entry}`).join(",\n")}\n})`;
};

/** The code writer an HTML catalogue's shell writes a story's code with: the name the generated pages import. */
export const codeOf: StoryCodeWriter = storyCall;
