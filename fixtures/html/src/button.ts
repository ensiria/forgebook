/**
 * A button drawn from its args, as a library with no framework writes one: a function that returns a DOM node.
 *
 * @module
 */
import type { tones } from "./tones";

/** What a button is drawn from. */
export type ButtonArgs = {
  /** The text on the button. */
  readonly label: string;
  /**
   * Its colour.
   *
   * @defaultValue `"neutral"`
   */
  readonly tone?: (typeof tones)[number];
  /** Whether it can be pressed. */
  readonly disabled?: boolean;
  /** Called when the person presses it. */
  readonly onPress?: (event: MouseEvent) => void;
};

/**
 * A button that does one thing.
 */
export const createButton = ({
  label,
  tone = "neutral",
  disabled = false,
  onPress
}: ButtonArgs): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `button button--${tone}`;
  button.dataset["testid"] = "button";
  button.disabled = disabled;
  button.textContent = label;
  if (onPress !== undefined) button.addEventListener("click", onPress);
  return button;
};
