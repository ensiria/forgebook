/**
 * A text that breaks for one value, so a story shows its error and comes back from it.
 *
 * @module
 */
import { html, LitElement, type TemplateResult } from "lit";

/** A fragile text. */
export class FixtureFragile extends LitElement {
  static override properties = { text: {} };

  /** What it shows; `boom` breaks it. */
  declare text: string;

  constructor() {
    super();
    this.text = "Fine";
  }

  protected override render(): TemplateResult {
    if (this.text === "boom") throw new Error("Fragile broke");
    return html`<p data-testid="fragile">${this.text}</p>`;
  }
}

customElements.define("fixture-fragile", FixtureFragile);

declare global {
  interface HTMLElementTagNameMap {
    "fixture-fragile": FixtureFragile;
  }
}
