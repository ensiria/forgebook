/**
 * A short label beside a thing.
 *
 * @module
 */
/* eslint-disable tsdoc/syntax -- the tags Lit's analyzer reads (`@fires {Type} name`, `@slot`, `@csspart`) and the
   catalogue's usage tags are what this fixture exists to read, and TSDoc defines none of them */
import { html, type LitElement, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { UiBase } from "./UiBase.ts";

/** A decorator stacked before `@property`, as Lit's context writes `@consume`. */
const shared = (): PropertyDecorator => (): void => undefined;

/** The tones a badge takes. */
export type BadgeTone = "neutral" | "info" | "danger";

/**
 * A badge.
 *
 * @fires {CustomEvent<string>} remove - The person took it away.
 * @slot - The label, when it is more than text.
 * @slot icon - An icon before the label.
 * @csspart label - The label's box.
 * @useWhen A count or a state beside a title.
 * @avoidWhen The text is a sentence.
 */
@customElement("ui-badge")
export class UiBadge extends UiBase {
  /** The text it shows. */
  @property() label = "";

  /**
   * How loud it is.
   *
   * @defaultValue "neutral"
   */
  @property({ reflect: true }) tone: BadgeTone = "neutral";

  /** How many there are. */
  @property({ type: Number, attribute: "item-count" }) count = 0;

  /** Whether it is quieter. */
  @property({ type: Boolean }) quiet = false;

  /** The words it is searched by: a property only, since a list has no attribute. */
  @shared() @property({ attribute: false }) keywords: readonly string[] = [];

  /** Whether the pointer is over it: internal state, never an arg. */
  @state() hovered = false;

  /** An internal value, by its name. */
  _cache = "";

  protected override render(): TemplateResult {
    return html`<span part="label" ?data-hovered=${this.hovered}>${this.label}</span>`;
  }

  /** Takes it away. */
  remove(): void {
    this.dispatchEvent(new CustomEvent("remove", { detail: this.label }));
    this.dispatchEvent(new Event("removed"));
    this.hovered = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ui-badge": UiBadge;
  }
}

/** Kept so the base's import is not only a type's. */
export const BADGE_BASE: typeof LitElement = UiBase;
