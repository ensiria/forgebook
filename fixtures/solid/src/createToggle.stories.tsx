/**
 * A story about logic: a scene using a primitive, whose signature the catalogue documents.
 *
 * @module
 */
import type { LogicMeta, LogicStory } from "@forgebook/solid";

import { createToggle } from "./createToggle";

export default {
  title: "Logic/createToggle",
  component: createToggle,
  parameters: { logic: true }
} satisfies LogicMeta<typeof createToggle>;

/** A button that flips. */
export const Default: LogicStory = {
  parameters: { controls: false },
  render: () => {
    const [isOn, flip] = createToggle();
    return (
      <button type="button" onClick={flip}>
        {isOn() ? "On" : "Off"}
      </button>
    );
  }
};
