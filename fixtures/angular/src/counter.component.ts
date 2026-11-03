/**
 * A counter with state of its own: new args must not start it over.
 *
 * @module
 */
import { Component, input, signal } from "@angular/core";

/** A button that counts its clicks under a label. */
@Component({
  selector: "fb-counter",
  template: `<button type="button" data-testid="counter" (click)="clicks.set(clicks() + 1)">{{ label() }}: {{ clicks() }}</button>`
})
export class Counter {
  /** What is counted. */
  readonly label = input("Clicks");

  /** The clicks so far. */
  protected readonly clicks = signal(0);
}
