/**
 * One Vitest test per story: it renders to a string with `react-dom/server` without errors, so no component reads
 * `window` or `document` while rendering (D-71), and its controls tell the truth (`storyControlsProblem`).
 *
 * @remarks
 * The stories load through the source's own globs, which Vitest understands. `wrap` puts each story inside a
 * provider (a partial translation catalogue, when the library has one) for a second pass, and can check its HTML. The
 * source's `setup` runs first.
 *
 * @module
 */

import type { StorySource } from "@ensiria/story-format/source";
import { createElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

import { heldFrameClock } from "../frame/frameClock";
import { StoryFrame } from "../frame/StoryFrame";
import { readStory } from "../frame/storyModule";
import { sourceFiles } from "../sourceFiles";
import { BASE_LANGUAGE } from "../storyTexts";
import { storyLocations, storyTree } from "../storyTree";
import { storyControlsProblem } from "./storyControls";

/** A second pass: each story inside a wrapper, its HTML optionally checked. */
export type StoryServerPass = {
  /** The pass's name, in each test's title (`partial catalogue`). */
  readonly name: string;
  /** The story inside the wrapper (`(story) => <Provider messages={partial}>{story}</Provider>`). */
  readonly render: (story: ReactNode) => ReactNode;
  /** Checks the story's HTML, with Vitest's `expect` (no message key shown, for a partial catalogue); none by default. */
  readonly check?: (html: string) => void;
};

/** The generated tests' options. */
export type StoryServerTestsOptions = {
  /** A second pass over every story. */
  readonly wrap?: StoryServerPass;
};

/**
 * Declares the tests, one `describe` per component and one test per story (and per story wrapped).
 *
 * @param source - the source, with its globs.
 * @param options - an optional wrapper for a second pass.
 */
export const storyServerTests = (source: StorySource, options: StoryServerTestsOptions = {}): void => {
  const passes: readonly StoryServerPass[] = [
    { name: "alone", render: (story: ReactNode): ReactNode => story },
    ...(options.wrap === undefined ? [] : [options.wrap])
  ];
  beforeAll(async () => {
    await source.setup?.();
  });
  const locations = storyLocations(storyTree([source]));
  for (const [title, entries] of Map.groupBy(locations, (location) => location.component.title)) {
    describe(title, () => {
      for (const { story, component } of entries) {
        it.each(passes)(`${story.name} renders on the server ($name)`, async (pass) => {
          const load = sourceFiles(source).stories[component.file];
          if (load === undefined) throw new Error(`No loader for ${component.file}`);
          const loaded = readStory(await load(), story.exportName);
          if (typeof loaded === "string") throw new Error(loaded);
          const element = createElement(StoryFrame, {
            story: loaded,
            // a Live story renders at its start, as the frame's tests picture it (D-504)
            clock: heldFrameClock(loaded.clockStart ?? 0),
            onControlsReady: (): void => undefined,
            onEvent: (): void => undefined,
            onTrace: (): void => undefined,
            // the stories' own texts: what the catalogue shows when no language is chosen
            texts: source.texts?.[BASE_LANGUAGE] ?? {},
            // a render error fails the test: the server does not run error boundaries, and none may be swallowed
            onError: (message: string): void => {
              throw new Error(message);
            }
          });
          let html = "";
          expect(() => {
            html = renderToString(pass.render(element));
          }).not.toThrow();
          pass.check?.(html);
        });
        it(`${story.name} declares the controls it uses`, async () => {
          const load = sourceFiles(source).stories[component.file];
          if (load === undefined) throw new Error(`No loader for ${component.file}`);
          const loaded = readStory(await load(), story.exportName);
          if (typeof loaded === "string") throw new Error(loaded);
          expect(storyControlsProblem(loaded)).toBeUndefined();
        });
      }
    });
  }
};
