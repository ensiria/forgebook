/**
 * A short status next to what it describes: the fixture's component written the modern way, with signal inputs, a
 * model, an output and projected content.
 *
 * @module
 */
import { Component, input, model, output } from "@angular/core";

import type { Tone } from "./tones";

/** A badge: a label in a tone, with an icon and a count, that a person can take away. */
@Component({
  selector: "fb-badge",
  templateUrl: "./badge.component.html",
  styleUrl: "./badge.component.css"
})
export class Badge {
  /** What the badge says. */
  readonly label = input.required<string>();

  /** Its colour. */
  readonly tone = input<Tone>("info");

  /** How many, shown after the label; the badge counts down when pressed. */
  readonly count = model(0);

  /** The person took it away. */
  readonly removed = output<string>();

  /** Counts one down. */
  protected countDown(): void {
    this.count.update((count) => Math.max(0, count - 1));
  }
}
