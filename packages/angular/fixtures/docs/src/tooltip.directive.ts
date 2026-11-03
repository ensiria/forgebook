/**
 * A directive: the reader takes its inputs as a component's.
 *
 * @module
 */
import { Directive, Input, input } from "@angular/core";

/** A tooltip on any element. */
@Directive({ selector: "[fbTooltip]" })
export class Tooltip {
  /** The tooltip's text. */
  readonly fbTooltip = input("");

  /** Where it opens, read back as a text. */
  get side(): string {
    return this.placement;
  }

  /** Where it opens. */
  @Input() set side(value: "top" | "bottom") {
    this.placement = value;
  }

  /** Where it opens, kept. */
  private placement = "top";
}
