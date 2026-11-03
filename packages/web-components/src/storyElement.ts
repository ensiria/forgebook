/**
 * The meta's element in the page, for a story with no render: made once, then brought to each new set of args, so it
 * keeps its own state as the panel changes them.
 *
 * @remarks
 * Each arg goes where its name says (`argNames.ts`). An attribute takes a text, a number or a boolean, as HTML does
 * (`false`, `null` and `undefined` take it away); any other value under a plain name (a list, an object) is set as the
 * property of that name, since an attribute would only hold its text. An arg that goes away takes its attribute away,
 * or puts its property back to the value the element had before the story set it. A slot's content is drawn with Lit into the
 * element's light DOM, before a marker of its own, so an element that draws its light DOM with Lit as well keeps its own
 * part. Listeners are the renderer's (`webComponentsRenderer.ts`), set once on the canvas.
 *
 * @module
 */
import type { LoadedArgs } from "forgebook/story-module";
import { render } from "lit";

import { argTarget } from "./argNames.ts";
import { slotsContent } from "./slotContent.ts";

/** An element of a story, with what it was last given. */
export type StoryElement = {
  /** The element. */
  readonly element: HTMLElement;
  /**
   * Brings it to new args: sets what changed, takes away what is gone.
   *
   * @param args - the args.
   */
  readonly apply: (args: LoadedArgs) => void;
};

/**
 * Whether a value fits an attribute: a text, a number, a boolean or nothing.
 *
 * @param value - the arg's value.
 */
const isAttributeValue = (value: unknown): value is string | number | boolean | null | undefined =>
  value === null || ["string", "number", "boolean", "undefined"].includes(typeof value);

/**
 * Sets one attribute, or takes it away.
 *
 * @param element - the element.
 * @param name - the attribute.
 * @param value - its value.
 */
const setAttribute = (
  element: HTMLElement,
  name: string,
  value: string | number | boolean | null | undefined
): void => {
  if (value === false || value === null || value === undefined) element.removeAttribute(name);
  else element.setAttribute(name, value === true ? "" : String(value));
};

/**
 * The attribute Lit gives a field: the one its options name, its name in lowercase by default, none for `false`.
 *
 * @param field - the field's name.
 * @param options - its options, as its class keeps them.
 */
const litAttribute = (field: string, options: unknown): string | undefined => {
  const named =
    typeof options === "object" && options !== null && "attribute" in options ? options.attribute : undefined;
  if (typeof named === "string") return named;
  return named === false ? undefined : field.toLowerCase();
};

/**
 * The field an attribute sets, for a value an attribute cannot hold (a list, an object): the one a Lit element's class
 * names for the attribute (`attribute: "selected-items"`, or its name in lowercase by default), else the attribute's
 * name in camel case when the element has such a field, else the attribute's own name.
 *
 * @param element - the element.
 * @param attribute - the attribute's name.
 */
const propertyOfAttribute = (element: HTMLElement, attribute: string): string => {
  const properties: unknown = Reflect.get(element.constructor, "elementProperties");
  if (properties instanceof Map) {
    // Lit keeps each field's options on its class: `attribute` names its attribute, `false` for none
    for (const entry of properties.entries()) {
      const [field, options]: readonly [unknown, unknown] = entry;
      if (typeof field === "string" && litAttribute(field, options) === attribute) return field;
    }
  }
  const camel = attribute.replace(/-([a-z])/g, (_match: string, letter: string) => letter.toUpperCase());
  return camel !== attribute && camel in element ? camel : attribute;
};

/**
 * Makes the meta's element.
 *
 * @param tag - its tag.
 * @returns the element and what brings it to new args.
 */
export const storyElement = (tag: string): StoryElement => {
  const element = document.createElement(tag);
  const marker = document.createComment("forgebook slots");
  element.append(marker);
  /** Each property's value before a story first set it: what it goes back to when the arg goes away. */
  const initial = new Map<string, unknown>();
  const setProperty = (name: string, value: unknown): void => {
    if (!initial.has(name)) initial.set(name, Reflect.get(element, name));
    Reflect.set(element, name, value);
  };
  const restoreProperty = (name: string): void => {
    if (initial.has(name)) Reflect.set(element, name, initial.get(name));
  };
  const setArg = (name: string, value: unknown): void => {
    const target = argTarget(name);
    if (target.kind === "property") setProperty(target.name, value);
    if (target.kind !== "attribute") return;
    const property = propertyOfAttribute(element, target.name);
    if (!isAttributeValue(value)) {
      setProperty(property, value);
      return;
    }
    // a list the arg held before went to the property: the attribute speaks for the field again
    restoreProperty(property);
    setAttribute(element, target.name, value);
  };
  const clearArg = (name: string): void => {
    const target = argTarget(name);
    if (target.kind === "property") restoreProperty(target.name);
    if (target.kind !== "attribute") return;
    element.removeAttribute(target.name);
    restoreProperty(propertyOfAttribute(element, target.name));
  };
  let applied: LoadedArgs = {};
  const apply = (args: LoadedArgs): void => {
    for (const name of Object.keys(applied)) if (!(name in args)) clearArg(name);
    for (const [name, value] of Object.entries(args)) {
      if (!(name in applied) || applied[name] !== value) setArg(name, value);
    }
    render(slotsContent(args), element, { renderBefore: marker });
    applied = args;
  };
  return { element, apply };
};
