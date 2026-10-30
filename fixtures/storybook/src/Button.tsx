/**
 * A button, as Storybook's own example writes one: the component the Storybook fixture's stories show.
 *
 * @module
 */
import type { MouseEventHandler, ReactNode } from "react";

/** The button's props. */
export type ButtonProps = {
  /** The text on the button. */
  readonly label: string;
  /** How loud the button is. */
  readonly variant?: "primary" | "secondary";
  /** How big it is. */
  readonly size?: "small" | "medium" | "large";
  /** Its background colour, any CSS colour. */
  readonly backgroundColor?: string;
  /** Called when it is pressed. */
  readonly onClick?: MouseEventHandler<HTMLButtonElement>;
};

/**
 * A button.
 *
 * @param props - its label, look and handler.
 */
export const Button = ({
  label,
  variant = "primary",
  size = "medium",
  backgroundColor,
  onClick
}: ButtonProps): ReactNode => (
  <button
    type="button"
    data-variant={variant}
    data-size={size}
    style={backgroundColor === undefined ? undefined : { backgroundColor }}
    onClick={onClick}
  >
    {label}
  </button>
);
