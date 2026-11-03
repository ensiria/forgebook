/**
 * The renderer tests' components: a card that projects content and tells when it is pressed, a frame to wrap a story
 * in, a greeting that reads a provided name, the story's texts and its clock, and a component that is not standalone.
 *
 * @module
 */
import { Component, InjectionToken, Input, inject, input, NgModule, output, signal } from "@angular/core";

import { injectStoryNow } from "../../src/clock.ts";
import { injectStoryText } from "../../src/texts.ts";

/** A name provided to the stories that ask for one. */
export const WHO = new InjectionToken<string>("who");

/** A card with a title, a header slot, a body, and a counter of its own. */
@Component({
  selector: "fb-card",
  template: `<article>
    <h1>{{ title() }}</h1>
    <header><ng-content select="[header]" /></header>
    <main><ng-content /></main>
    <button type="button" (click)="press()">Pressed {{ presses() }}</button>
  </article>`
})
export class Card {
  /** The card's title. */
  readonly title = input("");

  /** The card was pressed, with how many times so far. */
  readonly pressed = output<number>();

  /** The presses so far. */
  protected readonly presses = signal(0);

  /** Counts a press and says so. */
  protected press(): void {
    this.presses.update((count) => count + 1);
    this.pressed.emit(this.presses());
  }
}

/** A frame around what it projects. */
@Component({
  selector: "fb-frame",
  template: `<div class="frame" [attr.data-tone]="tone()"><ng-content /></div>`
})
export class Frame {
  /** The frame's tone. */
  readonly tone = input("plain");
}

/** Greets whoever the stories provide, in the story's language, at the story's time. */
@Component({ selector: "fb-hello", template: `<p>{{ text("hello", { who: who }) }} {{ now() }}</p>` })
export class Hello {
  /** Who is greeted. */
  protected readonly who = inject(WHO, { optional: true }) ?? "nobody";

  /** The story's texts. */
  protected readonly text = injectStoryText();

  /** The story's moment. */
  protected readonly now = injectStoryNow();
}

/** A component that is not standalone, which a story declares, the way of Angular before standalone components. */
@Component({ selector: "fb-legacy", template: "<i>{{ word }}</i>", standalone: false })
export class Legacy {
  /** The word shown. */
  @Input() word = "";
}

/** Another component declared in a module, for a story that imports the module. */
@Component({ selector: "fb-older", template: "<u>{{ word }}</u>", standalone: false })
export class Older {
  /** The word shown. */
  @Input() word = "";
}

/** The module that declares it. */
@NgModule({ declarations: [Older], exports: [Older] })
export class OlderModule {}
