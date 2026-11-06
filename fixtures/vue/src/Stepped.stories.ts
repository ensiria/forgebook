/**
 * A prop set by a custom control written in Vue (`controls/stepper.ts`), registered in the catalogue's configuration.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/vue";

import Badge from "./Badge.vue";

export default {
  title: "Inputs/Stepped",
  component: Badge,
  args: { label: "New", count: 2 },
  argTypes: { count: { control: "stepper" } }
} satisfies Meta<typeof Badge>;

/** The count, set with the stepper. */
export const Default: Story<typeof Badge> = {};
