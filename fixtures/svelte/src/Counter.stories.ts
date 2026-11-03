/**
 * A story with state of its own, drawn from a render: new args must not start it over.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/svelte";

import Counter from "./Counter.svelte";

export default {
  title: "Inputs/Counter",
  component: Counter,
  args: { label: "Clicks" }
} satisfies Meta<typeof Counter>;

/** The counter, which a render returns each time the args change: the same component, so it keeps its clicks. */
export const Default: Story<typeof Counter> = {
  render: (args) => ({ Component: Counter, props: { label: args.label } })
};
