/**
 * The template that draws a component with a story's props: its selector's element, an input bound to each prop that
 * sets one, an output to each handler, and the projected content the `#` args fill, as Storybook's Angular stories
 * compute it, so a decorator that wraps `story().template` finds the component in it.
 *
 * @remarks
 * Only the props with a value are bound: Angular sets an input bound to `undefined` to `undefined`, and the input's own
 * default is lost. A prop whose name is not an identifier is read as `this['name']`. Projected content is put in place
 * with `ngProjectAs`, which reaches a content by its selector whatever the selector asks for.
 *
 * @module
 */
import { reflectComponentType, type Type } from "@angular/core";

import { attributeText, isVoidElement, openingOf, selectorElement } from "./selectorElement.ts";
import { argOfContent, DEFAULT_CONTENT } from "./slotArgs.ts";

/** Whether a name can be read in a template as it is. */
const isIdentifier = (name: string): boolean => /^[A-Za-z_$][\w$]*$/.test(name);

/**
 * A prop as a template expression reads it from the story's host.
 *
 * @param name - the prop's name.
 */
export const propReference = (name: string): string =>
  isIdentifier(name) ? name : `this['${name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}']`;

/**
 * One projected content, reading its arg.
 *
 * @param selector - the content's selector (`*` for the default).
 */
const contentBinding = (selector: string): string => {
  const text = `{{ ${propReference(argOfContent(selector))} }}`;
  return selector === DEFAULT_CONTENT
    ? text
    : `<ng-container ngProjectAs="${attributeText(selector)}">${text}</ng-container>`;
};

/**
 * The template of a component with these props.
 *
 * @param component - the component.
 * @param props - the story's props: inputs, outputs' handlers and content, by the names a template binds.
 * @param inner - what goes inside the component after the projected content, as a wrapper writes it; none by default.
 * @throws when the component is not one Angular can show (a directive has no element of its own: its story writes a
 *   template).
 */
export const componentTemplate = (
  component: Type<unknown>,
  props: Readonly<Record<string, unknown>>,
  inner = ""
): string => {
  const mirror = reflectComponentType(component);
  if (mirror === null)
    throw new Error(
      `${component.name} is not a component: a directive's story writes the template it is used in (render: (args) => ({ props: args, template: "…" }))`
    );
  const isSet = (name: string): boolean => props[name] !== undefined;
  const inputs = mirror.inputs
    .filter((input) => isSet(input.templateName))
    .map((input) => `[${input.templateName}]="${propReference(input.templateName)}"`);
  const outputs = mirror.outputs
    .filter((output) => typeof props[output.templateName] === "function")
    .map((output) => `(${output.templateName})="${propReference(output.templateName)}($event)"`);
  const contents = mirror.ngContentSelectors
    .filter((selector) => isSet(argOfContent(selector)))
    .map(contentBinding);
  const element = selectorElement(mirror.selector);
  const opening = [openingOf(element), ...inputs, ...outputs].join(" ");
  if (isVoidElement(element)) return `<${opening} />`;
  return `<${opening}>${contents.join("")}${inner}</${element.tag}>`;
};
