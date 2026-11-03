/**
 * A story that reads the catalogue's texts and the story clock from its context.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/web-components";
import { html } from "lit";

export default { title: "States/Greeting" } satisfies Meta;

/** A greeting with the day of the story clock, in the shown language. */
export const Live: Story = {
  parameters: { clock: { start: "2030-01-01T09:00:00Z" } },
  render: (_args, { text, clock }) =>
    html`<p data-testid="greeting">${text("greeting.hello")} ${new Date(clock.now()).toISOString().slice(0, 10)}</p>`
};
