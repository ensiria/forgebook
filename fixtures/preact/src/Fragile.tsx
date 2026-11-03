/**
 * A text that cannot say `boom`: it throws while it is drawn.
 *
 * @module
 */

/** The text's props. */
export type FragileProps = {
  /** The text shown. */
  readonly text: string;
};

/**
 * The text, or an error.
 *
 * @param props - the text.
 */
export const Fragile = ({ text }: FragileProps) => {
  if (text === "boom") throw new Error("Fragile broke");
  return <p data-testid="fragile">{text}</p>;
};
