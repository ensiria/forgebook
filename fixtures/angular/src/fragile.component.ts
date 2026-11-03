/**
 * A component that throws for one value, so a story shows its error can be changed back.
 *
 * @module
 */
import { Component, computed, input } from "@angular/core";

/** Shows its text; `boom` throws while drawing. */
@Component({ selector: "fb-fragile", template: `<p data-testid="fragile">{{ shown() }}</p>` })
export class Fragile {
  /** What it shows; `boom` throws while drawing. */
  readonly text = input("");

  /** The text, or the error. */
  protected readonly shown = computed(() => {
    if (this.text() === "boom") throw new Error("Fragile broke");
    return this.text();
  });
}
