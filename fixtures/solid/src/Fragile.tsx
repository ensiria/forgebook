/**
 * A text that cannot say `boom`: it throws while it is drawn.
 *
 * @module
 */
import { createMemo, type JSX } from "solid-js";

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
export const Fragile = (props: FragileProps): JSX.Element => {
  const text = createMemo(() => {
    if (props.text === "boom") throw new Error("Fragile broke");
    return props.text;
  });
  return <p data-testid="fragile">{text()}</p>;
};
