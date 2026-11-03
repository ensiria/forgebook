/**
 * An Angular story drawn as HTML on a server, for the generated server tests: the renderer's `renderToString` loads this
 * module when it is asked for, so the page never does.
 *
 * @remarks
 * The story is its host component, its template compiled (the meta's component alone has its template computed), in
 * an application `renderApplication` starts on Angular's server platform, with the story's application providers.
 * Angular's server carries on after an error in change detection, so the errors its handler receives fail the render.
 * Its platform puts its own DOM's classes on the global object; they are put back as they were after each render, so
 * stories drawn in a simulated page in the same tests (happy-dom) keep their DOM.
 *
 * @module
 */
import { ErrorHandler, signal } from "@angular/core";
import { type BootstrapContext, bootstrapApplication } from "@angular/platform-browser";
import { provideServerRendering, renderApplication } from "@angular/platform-server";
import type { StoryDrawing } from "forgebook/renderer";
import { storyContextOf } from "forgebook/renderer";

import { STORY_CLOCK } from "./clock.ts";
import { applicationProviders, compiledHost, HOST_SELECTOR, toError } from "./storyHost.ts";
import { composedStory, isClass } from "./storyResult.ts";
import { STORY_TEXTS } from "./texts.ts";

/** A global as it was: how it was defined, and its value through a getter. */
type KeptGlobal = { readonly descriptor: PropertyDescriptor; readonly value: unknown };

/**
 * A global's value, read through its getter: a simulated page (happy-dom) defines its DOM's classes as accessors.
 *
 * @param name - the global's name.
 */
const globalValue = (name: string): unknown => {
  try {
    return Reflect.get(globalThis, name);
  } catch {
    return undefined;
  }
};

/**
 * Runs a render, then puts the global object back as it was: what the render added is taken away, the classes it
 * replaced are restored, through the setter of a global defined with one. Renders must not overlap, as the generated
 * tests' do not (one story after another): one would take away what the other added.
 *
 * @param render - the render.
 */
const withGlobalsKept = async <TResult>(render: () => Promise<TResult>): Promise<TResult> => {
  const before = new Map<string, KeptGlobal>();
  for (const name of Object.getOwnPropertyNames(globalThis)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    if (descriptor !== undefined) before.set(name, { descriptor, value: globalValue(name) });
  }
  try {
    return await render();
  } finally {
    for (const name of Object.getOwnPropertyNames(globalThis)) {
      const kept = before.get(name);
      if (kept === undefined) Reflect.deleteProperty(globalThis, name);
      // only the DOM's classes are replaced: another global read through a getter may be new at each read (`CSS`)
      else if (typeof kept.value === "function" && globalValue(name) !== kept.value) {
        if (kept.descriptor.set === undefined) Object.defineProperty(globalThis, name, kept.descriptor);
        else Reflect.set(globalThis, name, kept.value);
      }
    }
  }
};

/**
 * The story's HTML: what its host draws, inside the page's body.
 *
 * @param drawing - the story, its args, texts, clock and language.
 * @throws what the story throws while drawn.
 */
export const renderOnServer = async (drawing: StoryDrawing): Promise<string> => {
  // no canvas on a server: a story that reads one fails as it would in a page rendered on a server
  const context = storyContextOf(drawing, drawing.args, (): HTMLElement => {
    throw new Error("A story drawn on a server has no canvas");
  });
  const composed = composedStory(drawing.story, context, drawing.decorators);
  const component = isClass(drawing.story.component) ? drawing.story.component : undefined;
  const Host = await compiledHost(composed.result, component);
  const failures: unknown[] = [];
  class CollectingErrorHandler extends ErrorHandler {
    override handleError(error: unknown): void {
      failures.push(error);
    }
  }
  const html = await withGlobalsKept(() =>
    renderApplication(
      (bootstrap: BootstrapContext) =>
        bootstrapApplication(
          Host,
          {
            providers: [
              provideServerRendering(),
              ...applicationProviders(composed.result),
              { provide: STORY_TEXTS, useValue: signal(drawing.texts).asReadonly() },
              { provide: STORY_CLOCK, useValue: signal(drawing.clock).asReadonly() },
              { provide: ErrorHandler, useClass: CollectingErrorHandler }
            ]
          },
          bootstrap
        ),
      { document: `<html><head></head><body><${HOST_SELECTOR}></${HOST_SELECTOR}></body></html>` }
    )
  );
  const [failure] = failures;
  if (failure !== undefined) throw toError(failure);
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html);
  return body?.[1] ?? html;
};
