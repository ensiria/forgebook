/**
 * A custom element written without Lit: what a library of plain custom elements documents and draws the same way.
 *
 * @module
 */
/* eslint-disable tsdoc/syntax -- `@slot` is the tag the Custom Elements Manifest's analyzer reads */

/**
 * A panel with a heading.
 *
 * @slot - The panel's content.
 */
export class FixturePanel extends HTMLElement {
  static readonly observedAttributes = ["heading"];

  readonly #heading = document.createElement("h2");

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.append(this.#heading, document.createElement("slot"));
  }

  /** Shows the heading the attribute names. */
  attributeChangedCallback(_name: string, _old: string | null, value: string | null): void {
    this.#heading.textContent = value;
  }
}

customElements.define("fixture-panel", FixturePanel);

declare global {
  interface HTMLElementTagNameMap {
    "fixture-panel": FixturePanel;
  }
}
