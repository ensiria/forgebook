/**
 * A story about logic: the signature of a function the stories use.
 *
 * @module
 */
import type { LogicMeta, LogicStory } from "@forgebook/html";

import { formatCount } from "./formatCount";

export default {
  title: "Logic/formatCount",
  component: formatCount,
  parameters: { logic: true }
} satisfies LogicMeta<typeof formatCount>;

/** Counts written out. */
export const Default: LogicStory = {
  parameters: { controls: false },
  render: () => `<p data-testid="counts">${[0, 1, 5].map(formatCount).join(", ")}</p>`
};
