/**
 * A story about logic: a scene using a composable, whose signature the catalogue documents.
 *
 * @module
 */
import type { LogicMeta, LogicStory } from "@forgebook/vue";
import { h } from "vue";

import { useToggle } from "./useToggle";

export default {
  title: "Logic/useToggle",
  component: useToggle,
  parameters: { logic: true }
} satisfies LogicMeta<typeof useToggle>;

/** A button that flips. */
export const Default: LogicStory = {
  parameters: { controls: false },
  render: () => ({
    setup: () => {
      const isOn = useToggle();
      return () =>
        h("button", { type: "button", onClick: () => (isOn.value = !isOn.value) }, isOn.value ? "On" : "Off");
    }
  })
};
