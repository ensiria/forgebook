/**
 * Every way a Web Components story draws: the element from its args, with its slots, a Lit template and HTML.
 *
 * @module
 */
import "@forgebook/story-format/testing-library";
import "./FixtureBadge";
import "./FixturePanel";

import type { Meta, Story } from "@forgebook/web-components";
import { html } from "lit";

export default {
  title: "Inputs/Badge",
  component: "fixture-badge",
  args: { label: "New" }
} satisfies Meta<"fixture-badge">;

/** The element with its args. */
export const Default: Story<"fixture-badge"> = {
  args: { tone: "info", "item-count": 3 },
  parameters: { main: true }
};

/** Slots filled from the args. */
export const WithSlots: Story<"fixture-badge"> = {
  args: { "#default": "from the slot", "#icon": "*" }
};

/** A render that returns a Lit template. */
export const FromTemplate: Story<"fixture-badge"> = {
  render: (args) =>
    html`<section data-testid="template"><fixture-badge label=${args.label ?? ""} tone="danger"></fixture-badge></section>`
};

/** A render that returns HTML, as Storybook's Web Components stories may. */
export const FromMarkup: Story<"fixture-badge"> = {
  parameters: { controls: false },
  render: () =>
    '<fixture-panel heading="Panel"><fixture-badge label="Inside"></fixture-badge></fixture-panel>'
};

/** The event a person sends, recorded in the catalogue. */
export const Removable: Story<"fixture-badge"> = {
  play: async ({ canvasElement, userEvent }) => {
    const button = canvasElement.querySelector("fixture-badge")?.shadowRoot?.querySelector("button");
    if (button !== null && button !== undefined) await userEvent.click(button);
  }
};
