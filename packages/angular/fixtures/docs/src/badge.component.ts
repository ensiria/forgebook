/**
 * A short status next to what it describes.
 *
 * @module
 */
import {
  booleanAttribute,
  Component,
  EventEmitter,
  Input,
  input,
  model,
  Output,
  output
} from "@angular/core";
import { outputFromObservable } from "@angular/core/rxjs-interop";
import { Subject } from "rxjs";

import { Labelled } from "./Base.ts";
import type { Tone } from "./tones.ts";

/**
 * A badge: a label in a tone.
 */
@Component({
  selector: "fb-badge",
  templateUrl: "./badge.component.html",
  inputs: ["legacy: old"]
})
export class Badge extends Labelled {
  /** What the badge says. */
  readonly label = input.required<string>();
  /** Its colour. */
  readonly tone = input<Tone>("info");
  /** How many, shown after the label. */
  readonly count = model(0);
  /** Whether it can be taken away. */
  @Input({ transform: booleanAttribute }) removable = false;
  /** Its size, under its old name. */
  @Input("size") badgeSize: "sm" | "md" = "md";
  /** A member listed in the decorator. */
  legacy = "";
  /** Whether it must be shown. */
  @Input({ required: true }) shown!: boolean;
  /** The person took it away. */
  readonly removed = output<string>();
  /** It was pressed. */
  @Output() pressed = new EventEmitter<MouseEvent>();
  /** It was hovered. */
  readonly hovered = outputFromObservable(new Subject<number>(), { alias: "hover" });
  /** Not an input. */
  protected internal = 1;
}
