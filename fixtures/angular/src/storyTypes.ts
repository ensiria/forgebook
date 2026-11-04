/**
 * What Angular's compiler must accept and refuse in a story's args: nothing runs this file, the type check is the test.
 *
 * @module
 */
import type { Story } from "@forgebook/angular";

import type { Badge } from "./badge.component";

/** A signal input, a model and its change, an output and projected content are args. */
export const Accepted: Story<typeof Badge> = {
  args: {
    label: "A",
    tone: "danger",
    count: 2,
    countChange: (count: number): void => {
      count.toFixed();
    },
    removed: (label: string): void => {
      label.trim();
    },
    "#default": "*",
    "#[icon]": "!"
  }
};

/** A value its input does not take. */
export const WrongValue: Story<typeof Badge> = {
  // @ts-expect-error a tone it does not have
  args: { tone: "loud" }
};

/** A member it does not have. */
export const WrongName: Story<typeof Badge> = {
  // @ts-expect-error an input it does not have
  args: { nope: "*" }
};

/** An output's handler that takes what it does not pass. */
export const WrongHandler: Story<typeof Badge> = {
  // @ts-expect-error the output passes a text
  args: { removed: (_count: number): void => undefined }
};
