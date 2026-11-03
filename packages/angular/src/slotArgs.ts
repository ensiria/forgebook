/**
 * Which args fill a component's projected content: `#default` the content with no `select`, `#<selector>` the
 * `<ng-content select="<selector>">` of that selector, as written (`#[icon]`, `#fb-card-title`).
 *
 * @remarks
 * Content has to say what it is: a component's inputs are known, but an arg they do not name could be content as well
 * as a typo. The selector is kept as written so nothing is lost: the renderer projects into it with `ngProjectAs`, and the
 * code writer writes an element it matches. Free of Angular, since the shell's code writer reads it too and the shell
 * loads no Angular.
 *
 * @module
 */

/** The selector of the content with no `select`, as Angular lists it. */
export const DEFAULT_CONTENT = "*";

/** The arg that fills the content with no `select`. */
const DEFAULT_ARG = "#default";

/**
 * The content an arg fills.
 *
 * @param name - the arg's name.
 * @returns the content's selector (`*` for the default), or none for an input or an output.
 */
export const contentOfArg = (name: string): string | undefined => {
  if (name === DEFAULT_ARG) return DEFAULT_CONTENT;
  return name.startsWith("#") && name.length > 1 ? name.slice(1) : undefined;
};

/**
 * The arg that fills a content.
 *
 * @param selector - the content's selector, as `ng-content` writes it (`*` or none for the default).
 */
export const argOfContent = (selector: string | undefined): string =>
  selector === undefined || selector === DEFAULT_CONTENT ? DEFAULT_ARG : `#${selector}`;
