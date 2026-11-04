/**
 * A greeting in the shown language, at the story clock's time, from whoever the application provides.
 *
 * @module
 */
import { DatePipe } from "@angular/common";
import { Component, InjectionToken, inject } from "@angular/core";
import { injectStoryNow } from "@forgebook/angular/clock";
import { injectStoryText } from "@forgebook/angular/texts";

/** Who says hello, as an application provides it. */
export const GREETER = new InjectionToken<string>("greeter");

/** A greeting at the story's time. */
@Component({
  selector: "fb-greeting",
  imports: [DatePipe],
  template: `<p data-testid="greeting">{{ text("greeting.hello") }} {{ now() | date: "yyyy-MM-dd" : "UTC" }} {{ greeter }}</p>`
})
export class Greeting {
  /** The story's texts. */
  protected readonly text = injectStoryText();

  /** The story's moment. */
  protected readonly now = injectStoryNow();

  /** Who says hello. */
  protected readonly greeter = inject(GREETER, { optional: true }) ?? "";
}
