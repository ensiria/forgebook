/**
 * What every element of the fixture shares.
 *
 * @module
 */
import { LitElement } from "lit";
import { property } from "lit/decorators.js";

/** The base of the fixture's elements. */
export class UiBase extends LitElement {
  /** How dense it is. */
  @property() density: "compact" | "comfortable" = "comfortable";
}
