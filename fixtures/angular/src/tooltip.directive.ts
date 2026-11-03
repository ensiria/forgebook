/**
 * A directive: a title on any element, which a story shows in a template of its own.
 *
 * @module
 */
import { Directive, input } from "@angular/core";

/** Gives its element a tooltip. */
@Directive({ selector: "[fbTooltip]", host: { "[attr.title]": "fbTooltip()" } })
export class Tooltip {
  /** The tooltip's text. */
  readonly fbTooltip = input("");
}
