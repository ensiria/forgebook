/**
 * What `tsc` must accept and refuse in a story's args: nothing runs this file, the type check is the test.
 *
 * @module
 */
import type { Story } from "@forgebook/web-components";

import type { FixtureCounter } from "./FixtureCounter";

/** A field, an attribute named otherwise, a property, a listener and a slot are args. */
export const Accepted: Story<"fixture-badge"> = {
  args: {
    label: "A",
    tone: "info",
    "item-count": 2,
    ".keywords": ["a"],
    "@remove": (): void => undefined,
    "#icon": "*"
  }
};

/** A class's fields are args too. */
export const ByClass: Story<typeof FixtureCounter> = { args: { label: "Taps" } };

/** A value its field does not take. */
export const WrongValue: Story<"fixture-badge"> = {
  // @ts-expect-error a tone it does not have
  args: { tone: "loud" }
};

/** A property of the wrong type. */
export const WrongProperty: Story<"fixture-badge"> = {
  // @ts-expect-error keywords are texts
  args: { ".keywords": [1] }
};
