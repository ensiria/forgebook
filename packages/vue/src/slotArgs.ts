/**
 * Which args fill a slot: `#name`, as a template writes it, and `default`, as Storybook's Vue stories write it.
 *
 * @remarks
 * A slot has to say what it is: a component's runtime options list its props, and an arg they do not name could be a
 * slot as well as an attribute. Free of Vue, since the shell's code writer reads it too and the shell loads no Vue.
 *
 * @module
 */

/**
 * The slot an arg fills.
 *
 * @param name - the arg's name.
 * @returns the slot's name, or none for a prop.
 */
export const slotOfArg = (name: string): string | undefined => {
  if (name === "default") return name;
  return name.startsWith("#") ? name.slice(1) : undefined;
};
