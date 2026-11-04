/**
 * A story with state of its own, drawn from its args and from a template: new args must not start either over.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/angular";

import { Counter } from "./counter.component";

export default { title: "Inputs/Counter", component: Counter, args: { label: "Clicks" } } satisfies Meta<
  typeof Counter
>;

/** The counter from its args. */
export const Default: Story<typeof Counter> = {};

/** The counter inside a template that reads the args. */
export const Templated: Story<typeof Counter> = {
  render: (args) => ({ props: args, template: `<fb-counter [label]="label" />` })
};
