/**
 * A button that does one thing.
 *
 * @module
 */

/** How big a button is. */
export type Size = "sm" | "lg";

/** A button. */
export class XButton extends HTMLElement {
  /** How big it is. */
  size: Size = "sm";
}

customElements.define("x-button", XButton);
