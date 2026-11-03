/**
 * A story about logic: a scene using a hook, whose signature the catalogue documents.
 *
 * @module
 */
import type { LogicMeta, LogicStory } from "@forgebook/preact";

import { useToggle } from "./useToggle";

export default {
  title: "Logic/useToggle",
  component: useToggle,
  parameters: { logic: true }
} satisfies LogicMeta<typeof useToggle>;

/** A button that flips. */
export const Default: LogicStory = {
  parameters: { controls: false },
  render: () => {
    const [isOn, flip] = useToggle();
    return (
      <button type="button" onClick={flip}>
        {isOn ? "On" : "Off"}
      </button>
    );
  }
};
