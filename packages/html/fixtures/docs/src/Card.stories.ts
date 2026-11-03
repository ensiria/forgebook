/**
 * The stories the extractor reads a type of args from: the one the meta is checked against.
 *
 * @module
 */
import type { CardArgs } from "./card.ts";

type Meta<T> = { readonly title?: string; readonly render?: (args: Partial<T>) => string };

export default {
  title: "Card",
  render: (args: Partial<CardArgs>): string => `<article><h2>${args.heading ?? ""}</h2></article>`
} satisfies Meta<CardArgs>;

/** A card. */
export const Default = { args: { heading: "Hello" } };
