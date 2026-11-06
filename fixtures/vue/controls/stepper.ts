/**
 * A custom control written in Vue: nothing in the contract names a framework. Two buttons around a number.
 *
 * @module
 */
import type { ArgControlProps } from "forgebook/arg-control";
import { createApp, defineComponent, h, ref } from "vue";

/** What its value looks like. */
export const schema = { type: "integer", minimum: -100, maximum: 100 } as const;

/**
 * Draws the stepper.
 *
 * @param element - where it draws.
 * @param props - its value, how to change it, what the story says.
 * @returns what takes it away.
 */
export const mount = (element: HTMLElement, props: ArgControlProps): (() => void) => {
  const app = createApp(
    defineComponent({
      setup: () => {
        const count = ref(typeof props.value === "number" ? props.value : 0);
        const step = (by: number): void => {
          count.value += by;
          props.onChange(count.value);
        };
        return () =>
          h("div", [
            h("button", { type: "button", "aria-label": "One less", onClick: () => step(-1) }, "−"),
            h("output", { "data-testid": "stepper" }, String(count.value)),
            h("button", { type: "button", "aria-label": "One more", onClick: () => step(1) }, "+")
          ]);
      }
    })
  );
  app.mount(element);
  return () => app.unmount();
};
