/**
 * A story about logic: a scene using a function, whose signature the catalogue documents.
 *
 * @module
 */
import type { LogicMeta, LogicStory } from "@forgebook/angular";

import { injectToggle } from "./injectToggle";

export default {
  title: "Logic/injectToggle",
  component: injectToggle,
  parameters: { logic: true }
} satisfies LogicMeta<typeof injectToggle>;

/** A button that flips. */
export const Default: LogicStory = {
  parameters: { controls: false },
  render: () => ({
    props: { isOn: injectToggle() },
    template: `<button type="button" (click)="isOn.set(!isOn())">{{ isOn() ? "On" : "Off" }}</button>`
  })
};
