/**
 * What `svelte-check` must accept and refuse in a story's args: nothing runs this file, the type check is the test.
 *
 * @module
 */
import type { Story } from "@forgebook/svelte";
import { createRawSnippet } from "svelte";

import type Badge from "./Badge.svelte";

/** A prop, a callback prop, a snippet's text and a snippet are args. */
export const Accepted: Story<typeof Badge> = {
  args: {
    label: "A",
    tone: "info",
    onremove: (): void => undefined,
    "#icon": "*",
    children: createRawSnippet(() => ({ render: (): string => "<i>*</i>" }))
  }
};

/** A value its prop does not take. */
export const WrongValue: Story<typeof Badge> = {
  // @ts-expect-error a tone it does not have
  args: { tone: "loud" }
};

/** A snippet's text for a prop that takes no snippet. */
export const WrongSnippet: Story<typeof Badge> = {
  // @ts-expect-error `label` is no snippet
  args: { "#label": "*" }
};
