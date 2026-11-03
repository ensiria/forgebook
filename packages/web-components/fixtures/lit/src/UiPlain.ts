/**
 * An element written without decorators, as JavaScript writes Lit.
 *
 * @module
 */
/* eslint-disable tsdoc/syntax -- `@summary` is the tag Lit's analyzer reads, which TSDoc does not define */
import { LitElement } from "lit";

/**
 * A plain block.
 *
 * @summary A block with a title.
 * @deprecated Use `ui-badge`.
 */
export class UiPlain extends LitElement {
  static override properties = {
    heading: { type: String },
    open: { type: Boolean, attribute: "is-open" },
    secret: { state: true }
  };

  /** Its title. */
  declare heading: string;
  /** Whether it is open. */
  declare open: boolean;
  declare secret: string;

  constructor() {
    super();
    this.heading = "Untitled";
    this.open = false;
    this.secret = "";
  }
}

customElements.define("ui-plain", UiPlain);

/** Not an element: a file with one element and a helper. */
export const plainHelper = (): string => "helper";
