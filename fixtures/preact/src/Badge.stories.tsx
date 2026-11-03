/**
 * A component's props as args: drawn from the meta's component, spread in a render, and its event recorded.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/preact";

import { Badge } from "./Badge";

export default {
  title: "Inputs/Badge",
  component: Badge,
  args: { label: "New", tone: "info", count: 3 }
} satisfies Meta<typeof Badge>;

/** The component with its args. */
export const Default: Story<typeof Badge> = { parameters: { main: true } };

/** Its args spread in a render, inside a sentence. */
export const Spread: Story<typeof Badge> = {
  render: (args) => (
    <p data-testid="sentence">
      Status: <Badge label="" {...args} />
    </p>
  )
};

/** A badge the person can take away: the panel records the event. */
export const Removable: Story<typeof Badge> = { args: { onRemove: () => undefined } };
