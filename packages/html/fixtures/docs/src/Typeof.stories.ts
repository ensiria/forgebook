/**
 * The stories the extractor reads a function from: `typeof` in the meta's type.
 *
 * @module
 */
import { createButton } from "./button.ts";

type Meta<T> = { readonly title?: string; readonly render?: (args: T) => unknown };

export default {
  title: "Typeof",
  render: (): HTMLButtonElement => createButton({ label: "Save" })
} satisfies Meta<typeof createButton>;

/** The button. */
export const Default = {};
