/**
 * Every way a Vue story draws: from its args, with a slot, a virtual node and a template.
 *
 * @module
 */
import "@forgebook/story-format/testing-library";

import type { Meta, Story } from "@forgebook/vue";
import { h } from "vue";

import Badge from "./Badge.vue";

export default {
  title: "Inputs/Badge",
  component: Badge,
  args: { label: "New" }
} satisfies Meta<typeof Badge>;

/** The component with its args. */
export const Default: Story<typeof Badge> = {
  args: { tone: "info", count: 3 },
  parameters: { main: true }
};

/** A slot filled from the args. */
export const WithSlots: Story<typeof Badge> = {
  args: { "#default": "from the slot", "#icon": "*" }
};

/** A render that returns a virtual node. */
export const FromVNode: Story<typeof Badge> = {
  render: (args) => h(Badge, { label: args.label ?? "", tone: "danger" })
};

/** A render that returns a component, as Storybook's Vue stories do. */
export const FromTemplate: Story<typeof Badge> = {
  render: (args) => ({
    components: { Badge },
    setup: () => ({ args }),
    template: '<section data-testid="template"><Badge v-bind="args" /></section>'
  })
};

/** The event a person sends, recorded in the catalogue. */
export const Removable: Story<typeof Badge> = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Remove" }));
  }
};
