/**
 * A base class whose inputs a component inherits.
 *
 * @module
 */
import { Directive, input } from "@angular/core";

/** What every badge-like element takes. */
@Directive({ inputs: ["hint: tip"] })
export abstract class Labelled {
  /** The text a screen reader says, when it differs from what is shown. */
  readonly ariaLabel = input<string | undefined>(undefined, { alias: "aria-label" });

  /** A hint, listed by the base's decorator. */
  hint = "";
}
