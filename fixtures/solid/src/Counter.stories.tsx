/**
 * A story with state of its own, which runs once: new args reach its label in place, and its count stays.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/solid";

import { Counter } from "./Counter";

export default { title: "Inputs/Counter", component: Counter, args: { label: "Clicks" } } satisfies Meta<
  typeof Counter
>;

/** The counter, reading its label inside its JSX. */
export const Default: Story<typeof Counter> = { render: (args) => <Counter label={args.label ?? ""} /> };
