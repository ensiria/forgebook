/**
 * What the frame hands the components inside a story through Svelte's context: the shown language's texts and the story
 * clock, read when they are read, so a template that reads them follows a change.
 *
 * @remarks
 * The renderer's host sets it (`StoryHost.svelte`); `texts.ts` and `clock.ts` read it. Outside a catalogue there is
 * none, and each reader says what it falls back to.
 *
 * @module
 */
import type { StoryClock } from "@forgebook/story-format/clock";
import type { StoryTextTable } from "@forgebook/story-format/texts";
import { getContext, hasContext } from "svelte";

/** What a story's components read of the frame, each value of the moment. */
export type StoryView = {
  /** The texts of the shown language. */
  readonly texts: StoryTextTable;
  /** The story's clock: replaced when the story starts over. */
  readonly clock: StoryClock;
};

/** The context's key. */
export const STORY_VIEW: unique symbol = Symbol("forgebook story view");

/**
 * The view the frame set, for a component inside a story; called while the component is initialised, as Svelte's
 * context is.
 *
 * @returns the view, or none outside a catalogue.
 */
export const storyView = (): StoryView | undefined =>
  hasContext(STORY_VIEW) ? getContext<StoryView>(STORY_VIEW) : undefined;
