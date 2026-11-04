/**
 * Who a component's page is read by: the address's `audience` and a catalogue's default. Each audience is the same page
 * reordered and filtered (`shell/audienceLayout.ts`), never a page of its own.
 *
 * @remarks
 * `everyone` is the page as a catalogue that sets nothing has always drawn it. The list is short on purpose: each
 * audience answers a different question of the page, and a catalogue renames one with `strings`. Pure, and read by the
 * frame's `parseView` too, so it holds the ids and nothing else.
 *
 * @module
 */

/** Every audience, in the order the control lists them. */
export const AUDIENCE_IDS = ["everyone", "designer", "coder", "tester"] as const;

/** Who a component's page is read by. */
export type AudienceId = (typeof AUDIENCE_IDS)[number];

/** The audience of a catalogue that names none. */
export const DEFAULT_AUDIENCE: AudienceId = "everyone";
