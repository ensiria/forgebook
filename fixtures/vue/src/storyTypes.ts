/**
 * What `vue-tsc` must accept and refuse in a story's args: nothing runs this file, the type check is the test.
 *
 * @module
 */
import type { Story } from "@forgebook/vue";
import { type FunctionalComponent, h, type VNode } from "vue";

import type Badge from "./Badge.vue";

/** A functional component with a slot. */
const Tag: FunctionalComponent<{ readonly text: string }, Record<never, never>, { head: () => VNode }> = (
  props,
  { slots }
) => h("b", [props.text, slots.head()]);

/** A prop, a listener and a slot are args. */
export const Accepted: Story<typeof Badge> = {
  args: { label: "A", tone: "info", onRemove: (): void => undefined, "#icon": "*" }
};

/** A functional component's slot is an arg. */
export const FunctionalSlot: Story<typeof Tag> = { args: { text: "A", "#head": "*" } };

/** A value its prop does not take. */
export const WrongValue: Story<typeof Badge> = {
  // @ts-expect-error a tone it does not have
  args: { tone: "loud" }
};

/** A slot it does not have. */
export const WrongSlot: Story<typeof Badge> = {
  // @ts-expect-error a slot it does not have
  args: { "#nope": "*" }
};
