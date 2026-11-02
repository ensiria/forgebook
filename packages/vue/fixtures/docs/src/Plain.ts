/**
 * A component with no single-file component behind it.
 *
 * @module
 */
import { defineComponent, h, type PropType, type VNode } from "vue";

/**
 * A plain block.
 *
 * @deprecated Use `Badge`.
 */
export const Plain = defineComponent({
  props: {
    /** Its title. */
    title: { type: String, required: true },
    /** How it sits. */
    mode: { type: String as PropType<"wide" | "narrow">, default: "wide" }
  },
  emits: { pick: (id: number): boolean => id >= 0 },
  setup:
    (props: Readonly<{ title: string }>): (() => VNode) =>
    (): VNode =>
      h("div", props.title)
});

/** Another one, so a file with two components has to be asked which. */
export const Other = defineComponent({ setup: (): (() => VNode) => (): VNode => h("div") });

/** A component written as a function. */
// eslint-disable-next-line func-style -- a function declaration is the form this fixture exists to read
export function Plate(props: { readonly width: number }): VNode {
  return h("div", String(props.width));
}

/** A type beside the components, which is no component. */
export type PlainMode = "wide" | "narrow";

const Shelf = defineComponent({
  props: { depth: { type: Number, required: true } },
  setup:
    (props: Readonly<{ depth: number }>): (() => VNode) =>
    (): VNode =>
      h("div", String(props.depth))
});

export { Shelf };
