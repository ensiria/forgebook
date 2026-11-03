/**
 * Every way a Svelte story draws: from its args, with snippets from texts, and from a render.
 *
 * @module
 */
import "@forgebook/story-format/testing-library";

import type { Meta, Story } from "@forgebook/svelte";

import Badge from "./Badge.svelte";

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

/** Snippets filled from texts in the args. */
export const WithSnippets: Story<typeof Badge> = {
  args: { "#children": "from the snippet", "#icon": "*" }
};

/** A render that returns the component with props of its choosing, as Storybook's Svelte stories do. */
export const FromRender: Story<typeof Badge> = {
  render: (args) => ({ Component: Badge, props: { ...args, tone: "danger" } })
};

/** The event a person sends, recorded in the catalogue. */
export const Removable: Story<typeof Badge> = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Remove" }));
  }
};
