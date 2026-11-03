/**
 * What `tsc` must accept and refuse in a Solid story's args: nothing runs this file, the type check is the test.
 *
 * @module
 */
import type { Story } from "@forgebook/solid";

import type { Badge } from "./Badge";

/** A prop and an event are args. */
export const Accepted: Story<typeof Badge> = {
  args: { label: "A", tone: "info", onRemove: (): void => undefined }
};

/** A value its prop does not take. */
export const WrongValue: Story<typeof Badge> = {
  // @ts-expect-error a tone it does not have
  args: { tone: "loud" }
};

/** A prop it does not have. */
export const WrongProp: Story<typeof Badge> = {
  // @ts-expect-error a prop it does not have
  args: { nope: true }
};
