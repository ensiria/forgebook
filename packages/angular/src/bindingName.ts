/**
 * Which arg names a template may bind: free of Angular, since the shell's code writer reads it too.
 *
 * @remarks
 * An arg's name may come from the catalogue's address, written by anyone who sends a link. A name that is not one
 * (`title]="…"`) would write template syntax of its own into a story's compiled template, so it is never bound.
 *
 * @module
 */

/**
 * Whether a name can be bound in a template (`label`, `aria-label`, `attr.title`).
 *
 * @param name - the arg's name.
 */
export const isBindingName = (name: string): boolean =>
  /^[A-Za-z_$][\w$-]*(\.[A-Za-z_$][\w$-]*)*$/.test(name);
