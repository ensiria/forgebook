/**
 * Every way an Angular story draws: the component from its args, its projected content from `#` args, a template with
 * props, Storybook's helpers, and an output the panel records.
 *
 * @module
 */
import "@forgebook/story-format/testing-library";

import { argsToTemplate, componentWrapperDecorator, type Meta, type Story } from "@forgebook/angular";

import { Badge } from "./badge.component";

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

/** Projected content filled from the args: the default content, and the one an `[icon]` selects. */
export const WithContent: Story<typeof Badge> = {
  args: { "#default": "from the content", "#[icon]": "*" }
};

/** A template written by hand, its bindings from `argsToTemplate`. */
export const FromTemplate: Story<typeof Badge> = {
  render: (args) => ({
    props: args,
    template: `<section data-testid="template"><fb-badge ${argsToTemplate(args)}><b icon>!</b></fb-badge></section>`
  })
};

/** Wrapped by a decorator, as Storybook's Angular stories wrap one. */
export const Wrapped: Story<typeof Badge> = {
  args: { tone: "success" },
  decorators: [componentWrapperDecorator((story) => `<div data-testid="wrapped">${story}</div>`)]
};

/** The output a person sends, recorded in the catalogue. */
export const Removable: Story<typeof Badge> = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Remove" }));
  }
};
