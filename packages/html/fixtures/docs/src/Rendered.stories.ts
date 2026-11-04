/**
 * The stories the extractor reads a type of args from: the one the render writes.
 *
 * @module
 */
import type { CardArgs } from "./card.ts";

export default {
  title: "Rendered",
  render: (args: CardArgs): string => `<article><h2>${args.heading}</h2></article>`
};

/** A card. */
export const Default = { args: { heading: "Hello" } };
