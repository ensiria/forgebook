/**
 * An `async setup`: the story is drawn, and its play runs, once what it awaits has come.
 *
 * @module
 */
import "@forgebook/story-format/testing-library";

import type { Meta, Story } from "@forgebook/vue";
import { defineComponent, h, Suspense } from "vue";

import Awaited from "./Awaited.vue";

export default { title: "States/Awaited", component: Awaited } satisfies Meta<typeof Awaited>;

/** What the story's own boundary waits for: its content comes well after the first drawing. */
const Late = defineComponent({
  setup: async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return () => h("p", { "data-testid": "late" }, "Late");
  }
});

/** A boundary the frame did not write: the story is ready only with its content. */
export const InABoundaryOfItsOwn: Story<typeof Awaited> = {
  parameters: { controls: false },
  render: () =>
    h("section", [
      h(Suspense, null, {
        default: () => h(Late),
        fallback: () => h("p", { "data-testid": "fallback" }, "Loading")
      })
    ])
};

/** The component, awaited. */
export const Default: Story<typeof Awaited> = {
  play: async ({ canvas }) => {
    canvas.getByTestId("awaited");
  }
};
