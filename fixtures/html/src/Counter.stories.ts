/**
 * A plain custom element named in a story's HTML: new args set its attribute, and it keeps its own state.
 *
 * @module
 */
import "./FixtureCounter";

import type { Meta, Story } from "@forgebook/html";

/** The counter's args. */
type CounterArgs = {
  /** What the count is of. */
  readonly label: string;
};

export default {
  title: "Inputs/Counter",
  render: ({ label = "" }) => `<fixture-counter label="${label.replace(/"/g, "&quot;")}"></fixture-counter>`
} satisfies Meta<CounterArgs>;

/** A counter. */
export const Default: Story<CounterArgs> = { args: { label: "Clicks" } };
