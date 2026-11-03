/**
 * The args of a card, written for its stories.
 *
 * @module
 */

/** A card: a heading over a sentence. */
export type CardArgs = {
  /** The heading. */
  readonly heading: string;
  /** How many lines the sentence takes at most. */
  readonly lines?: number;
};
