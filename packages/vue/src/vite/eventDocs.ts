/**
 * A Vue component's events and slots as the catalogue lists them. A story sets an event as a listener (`onRemove`, which
 * is how Vue passes one), so the docs name it so, and the frame records it like any other framework's; a slot is listed
 * as the arg that fills it (`#default`).
 *
 * @module
 */
import type { EventSignature, PropDocs, SignatureParameter } from "forgebook/component-docs";
import ts from "typescript-6";
import type { EventMeta, SlotMeta } from "vue-component-meta";

/** The listener of an event (`remove` → `onRemove`, `update:modelValue` → `onUpdate:modelValue`). */
const listenerOf = (event: string): string => `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;

/**
 * One member of an event's tuple of arguments.
 *
 * @param member - the tuple's member.
 * @param index - its place, for the name of a member that has none.
 */
const parameterOf = (member: ts.TypeNode, index: number): SignatureParameter => {
  const name = `value${index === 0 ? "" : index + 1}`;
  if (ts.isNamedTupleMember(member)) {
    const dots = member.dotDotDotToken === undefined ? "" : "...";
    return { name: `${dots}${member.name.text}`, type: member.type.getText() };
  }
  return ts.isRestTypeNode(member)
    ? { name: `...${name}`, type: member.type.getText() }
    : { name, type: member.getText() };
};

/**
 * What an event passes, from its arguments' type as the checker prints it (`[id: string, force: boolean]`); a type that
 * is no tuple is its rest parameter.
 *
 * @param type - the arguments' type.
 */
const parametersOf = (type: string): SignatureParameter[] => {
  const source = ts.createSourceFile("event.ts", `type Passed = ${type};`, ts.ScriptTarget.Latest, true);
  const [alias] = source.statements;
  if (alias === undefined || !ts.isTypeAliasDeclaration(alias)) return [];
  if (!ts.isTupleTypeNode(alias.type)) return [{ name: "...values", type }];
  return alias.type.elements.map(parameterOf);
};

/** A signature as TypeScript writes it. */
const signatureText = (signature: EventSignature): string =>
  `(${signature.parameters.map(({ name, type }) => `${name}: ${type}`).join(", ")}) => void`;

/**
 * An event, as the listener a story sets.
 *
 * @param event - the event.
 * @param comments - what the source's `defineEmits` says of each event, for those the checker's type has lost.
 */
export const eventDocs = (event: EventMeta, comments: ReadonlyMap<string, string>): PropDocs => {
  const signature = { parameters: parametersOf(event.type), returns: "void" };
  return {
    name: listenerOf(event.name),
    kind: "event",
    type: signatureText(signature),
    description: event.description === "" ? (comments.get(event.name) ?? "") : event.description,
    isRequired: false,
    signature
  };
};

/**
 * A slot, as the arg that fills it: any text can, so the panel offers a field.
 *
 * @param slot - the slot.
 */
export const slotDocs = (slot: SlotMeta): PropDocs => ({
  name: `#${slot.name}`,
  kind: "other",
  type: slot.type === "any" || slot.type === "{}" ? "Slot" : `Slot<${slot.type}>`,
  description: slot.description,
  isRequired: false,
  canTakeText: true
});
