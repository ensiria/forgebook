/**
 * A story about logic: a scene using a function with runes, whose signature the catalogue documents.
 *
 * @module
 */
import type { LogicMeta, LogicStory } from "@forgebook/svelte";

import ToggleScene from "./ToggleScene.svelte";
import { createToggle } from "./toggle.svelte";

export default {
  title: "Logic/createToggle",
  component: createToggle,
  parameters: { logic: true }
} satisfies LogicMeta<typeof createToggle>;

/** A button that flips. */
export const Default: LogicStory = {
  parameters: { controls: false },
  render: () => ToggleScene
};
