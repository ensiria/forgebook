/**
 * The props a story's args stand for, for a catalogue that reads no component docs (`componentDocs: false`): the Props
 * tab's controls then come from the story's own args and its `argTypes`, as Storybook's do without a docgen.
 *
 * @remarks
 * An arg's kind is read from its value: a text, a number, a toggle, an event for an arg the frame records as an
 * action. A list or a value the source names (`namedValues`) is listed for reading, unless its type is one the source
 * names values for. Nothing is said of a prop the story gives no arg: without the types there is no way to know it.
 * The story's `argTypes` are laid over these as over the types' props (`argTypes.ts`). A shared link's values are
 * checked against these kinds (`addressArgs.ts`): without the types, a text arg takes any text, so a prop of a few
 * values keeps a link to them only through its `argTypes` options. Pure.
 *
 * @module
 */

import type { ComponentDocs, PropDocs } from "./componentDocs.ts";
import type { ArgValue, PanelArgs } from "./messages.ts";

/**
 * The prop an arg stands for, its kind and type read from its value.
 *
 * @param name - the arg's name.
 * @param value - its value, as the frame reported it.
 * @param isAction - whether the frame records it as an action.
 */
const propOfArg = (name: string, value: ArgValue, isAction: boolean): PropDocs => {
  const prop = { name, description: "", isRequired: false };
  if (isAction) return { ...prop, kind: "event", type: "function" };
  if (typeof value === "string") return { ...prop, kind: "text", type: "string" };
  if (typeof value === "number") return { ...prop, kind: "number", type: "number" };
  if (typeof value === "boolean") return { ...prop, kind: "toggle", type: "boolean" };
  if (value === null) return { ...prop, kind: "other", type: "null" };
  if (Array.isArray(value)) return { ...prop, kind: "other", type: "array" };
  // a value the source names: its type, so the panel offers the source's values for it
  return { ...prop, kind: "other", type: "of" in value ? value.of : "unknown" };
};

/**
 * The props a story's args stand for, in the args' order, then its actions the args do not hold.
 *
 * @param args - the story's args, as its frame reported them.
 * @param actions - the args the frame records as actions.
 */
export const propsOfArgs = (args: PanelArgs, actions: readonly string[]): readonly PropDocs[] => {
  const recorded = new Set(actions);
  const fromArgs = Object.entries(args).map(([name, value]) => propOfArg(name, value, recorded.has(name)));
  const named = new Set(Object.keys(args));
  const fromActions = actions
    .filter((name) => !named.has(name))
    .map((name): PropDocs => ({ name, kind: "event", type: "function", description: "", isRequired: false }));
  return [...fromArgs, ...fromActions];
};

/**
 * A component's docs made from a story's args: its name, and the props its args stand for; nothing else is known
 * without its types.
 *
 * @param name - the component's name.
 * @param args - the story's args, as its frame reported them.
 * @param actions - the args the frame records as actions.
 */
export const docsOfArgs = (name: string, args: PanelArgs, actions: readonly string[]): ComponentDocs => ({
  name,
  description: "",
  summary: "",
  props: propsOfArgs(args, actions),
  parts: [],
  subcomponents: []
});
