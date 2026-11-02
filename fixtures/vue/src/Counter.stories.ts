/**
 * A story with state of its own, drawn from a template: new args must not start it over.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/vue";

import Counter from "./Counter.vue";

export default {
  title: "Inputs/Counter",
  component: Counter,
  args: { label: "Clicks" }
} satisfies Meta<typeof Counter>;

/** The counter inside a template that reads the args. */
export const Default: Story<typeof Counter> = {
  render: (args) => ({
    components: { Counter },
    setup: () => ({ args }),
    template: '<Counter v-bind="args" />'
  })
};
