/**
 * A button drawn from its args.
 *
 * @module
 */

/** The button's tones. */
export type ButtonTone = "neutral" | "danger";

/** What a button is drawn from. */
export type ButtonArgs = {
  /** The text on the button. */
  readonly label: string;
  /**
   * Its colour.
   *
   * @defaultValue `"neutral"`
   */
  readonly tone?: ButtonTone;
  /** Whether it can be pressed. */
  readonly disabled?: boolean;
  /** Called when it is pressed. */
  readonly onClick?: (event: MouseEvent) => void;
};

/**
 * A button that does one thing.
 */
export const createButton = ({
  label,
  tone = "neutral",
  disabled = false,
  onClick
}: ButtonArgs): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `button button--${tone}`;
  button.disabled = disabled;
  button.textContent = label;
  if (onClick !== undefined) button.addEventListener("click", onClick);
  return button;
};

/**
 * An icon beside a button.
 *
 * @param args - the icon's name.
 */
export const icon = (args: { readonly name: string }): string => `<i class="icon">${args.name}</i>`;
