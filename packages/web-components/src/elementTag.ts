/**
 * The tag a meta's `component` names: the tag itself (`"my-button"`), or the name a class is defined under. Read by the
 * page and by the server, which has Lit's registry in place of the browser's.
 *
 * @module
 */
import { isElementName } from "./argNames.ts";

/**
 * Whether a value is a custom element's class.
 *
 * @param value - the meta's component.
 */
const isElementClass = (value: unknown): value is CustomElementConstructor =>
  typeof value === "function" && value.prototype instanceof HTMLElement;

/**
 * The tag of a meta's element.
 *
 * @param component - the meta's component: a tag, or a class defined in the registry.
 * @returns the tag, or why there is none: a text that is no element's name, or a class not defined.
 */
export const elementTag = (component: unknown): { readonly tag: string } | { readonly problem: string } => {
  if (typeof component === "string") {
    return isElementName(component)
      ? { tag: component }
      : { problem: `"${component}" is not a custom element's name: it needs a hyphen and no capital` };
  }
  if (!isElementClass(component))
    return { problem: "The meta's component is neither a tag nor an element's class" };
  const tag = customElements.getName(component);
  return tag === null
    ? {
        problem: `${component.name} is not defined: its module calls customElements.define before its stories draw`
      }
    : { tag };
};
