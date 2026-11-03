/**
 * A component that awaits: the story is drawn, and its play runs, once what it awaits has come.
 *
 * @module
 */
import "@forgebook/story-format/testing-library";

import type { Meta, Story } from "@forgebook/svelte";

import Awaited from "./Awaited.svelte";

export default { title: "States/Awaited", component: Awaited } satisfies Meta<typeof Awaited>;

/** The component, awaited. */
export const Default: Story<typeof Awaited> = {
  play: async ({ canvas }) => {
    canvas.getByTestId("awaited");
  }
};
