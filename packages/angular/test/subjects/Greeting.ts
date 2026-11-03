/**
 * The adapter suite's subject: a greeting that counts its clicks in its own state, and throws for one name.
 *
 * @module
 */
import { Component, computed, input, signal } from "@angular/core";

/** The name the greeting throws for. */
const THROWING_NAME = "boom";

/** A button that greets a name and counts its clicks. */
@Component({
  selector: "fb-greeting",
  template: `<button type="button" (click)="count()">{{ message() }} {{ clicks() }}</button>`
})
export class Greeting {
  /** Who is greeted. */
  readonly name = input<string>("");

  /** The clicks so far. */
  protected readonly clicks = signal(0);

  /** The greeting, which throws for one name. */
  protected readonly message = computed(() => {
    if (this.name() === THROWING_NAME) throw new Error("No greeting");
    return `Hello ${this.name()}`;
  });

  /** Counts a click. */
  protected count(): void {
    this.clicks.update((clicks) => clicks + 1);
  }
}
