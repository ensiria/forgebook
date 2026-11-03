/**
 * A resource: the story is drawn, and its play runs, once it has loaded.
 *
 * @module
 */
import "@forgebook/story-format/testing-library";

import type { Meta, Story } from "@forgebook/solid";

import { Loaded } from "./Loaded";

export default { title: "States/Loaded", component: Loaded } satisfies Meta<typeof Loaded>;

/** The component, loaded. */
export const Default: Story<typeof Loaded> = {
  play: async ({ canvas }) => {
    if (canvas.getByTestId("loaded").textContent !== "Loaded") throw new Error("Not loaded yet");
  }
};
