/**
 * A button that counts its presses in its own state, so a story shows that new args keep it.
 *
 * @module
 */
import { html, LitElement, type TemplateResult } from "lit";

/** A counter. */
export class FixtureCounter extends LitElement {
  static override properties = { label: {} };

  /** What it counts. */
  declare label: string;

  /** The presses so far: its own state, which no arg sets. */
  #clicks = 0;

  constructor() {
    super();
    this.label = "Clicks";
  }

  /** Counts a press. */
  readonly #press = (): void => {
    this.#clicks += 1;
    this.requestUpdate();
  };

  protected override render(): TemplateResult {
    return html`<button type="button" data-testid="counter" @click=${this.#press}>${this.label}: ${this.#clicks}</button>`;
  }
}

customElements.define("fixture-counter", FixtureCounter);

declare global {
  interface HTMLElementTagNameMap {
    "fixture-counter": FixtureCounter;
  }
}
