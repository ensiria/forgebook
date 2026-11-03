/**
 * A short label beside a thing, which the person can take away.
 *
 * @module
 */
/* eslint-disable tsdoc/syntax -- the tags the Custom Elements Manifest's analyzer reads (`@fires`, `@slot`,
   `@csspart`) are not TSDoc's */
import { css, html, LitElement, type TemplateResult } from "lit";

import type { Tone } from "./tones";

/**
 * A badge.
 *
 * @fires remove - The person took it away.
 * @slot - More than a text, after the label.
 * @slot icon - An icon before the label.
 * @csspart label - The label's box.
 */
export class FixtureBadge extends LitElement {
  static override properties = {
    label: {},
    tone: { reflect: true },
    count: { type: Number, attribute: "item-count" },
    quiet: { type: Boolean },
    keywords: { attribute: false }
  };

  static override styles = css`
    :host { display: inline-flex; gap: 0.25rem; align-items: center; font: 14px system-ui, sans-serif; }
    :host([tone="danger"]) [part="label"] { color: #b3261e; }
    :host([tone="info"]) [part="label"] { color: #0b57d0; }
  `;

  /** The text it shows. */
  declare label: string;
  /** How loud it is. */
  declare tone: Tone;
  /** How many there are. */
  declare count: number;
  /** Whether it is quieter. */
  declare quiet: boolean;
  /** The words it is searched by. */
  declare keywords: readonly string[];

  constructor() {
    super();
    this.label = "";
    this.tone = "neutral";
    this.count = 0;
    this.quiet = false;
    this.keywords = [];
  }

  /** Tells the page the person took it away. */
  private readonly remove_ = (): void => {
    this.dispatchEvent(new CustomEvent("remove", { detail: this.label, bubbles: true, composed: true }));
  };

  protected override render(): TemplateResult {
    return html`<slot name="icon"></slot><span part="label" class="badge">${this.label}</span
      ><slot></slot>${this.count > 0 ? html`<b>${this.count}</b>` : ""}
      <button type="button" aria-label="Remove" @click=${this.remove_}>×</button>`;
  }
}

customElements.define("fixture-badge", FixtureBadge);

declare global {
  interface HTMLElementTagNameMap {
    "fixture-badge": FixtureBadge;
  }
}
