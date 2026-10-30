/**
 * One Vitest test per story: the framework renders it to a string without errors (`renderToString` of its renderer),
 * so no component reads `window` or `document` while rendering (D-71), and its controls tell the truth
 * (`storyControlsProblem`).
 *
 * @remarks
 * The stories load through the source's own globs, which Vitest understands. `wrap` puts each story inside a
 * provider (a partial translation catalogue, when the library has one) for a second pass, and can check its HTML. The
 * source's `setup` runs first.
 *
 * @module
 */

import type { StoryLanguage, StorySource } from "@forgebook/story-format/source";
import { storyTextOf } from "@forgebook/story-format/texts";
import { heldFrameClock } from "forgebook/frame-clock";
import type { StoryRenderer } from "forgebook/renderer";
import { sourceFiles } from "forgebook/source-files";
import { readStory } from "forgebook/story-module";
import { BASE_LANGUAGE, withStoryTexts } from "forgebook/story-texts";
import { storyLocations, storyTree } from "forgebook/story-tree";
import { beforeAll, describe, expect, it } from "vitest";

import { storyControlsProblem } from "./storyControls";

/** A second pass: each story inside a wrapper, its HTML optionally checked. */
export type StoryServerPass = {
  /** The pass's name, in each test's title (`partial catalogue`). */
  readonly name: string;
  /** The story inside the wrapper (`(story) => <Provider messages={partial}>{story}</Provider>`); none draws it alone. */
  readonly render: StoryLanguage["wrap"] | undefined;
  /** Checks the story's HTML, with Vitest's `expect` (no message key shown, for a partial catalogue); none by default. */
  readonly check?: (html: string) => void;
};

/** The generated tests' options. */
export type StoryServerTestsOptions = {
  /** The framework that draws the stories (`reactRenderer` of `@forgebook/react`). */
  readonly renderer: StoryRenderer;
  /** A second pass over every story. */
  readonly wrap?: StoryServerPass;
};

/**
 * Declares the tests, one `describe` per component and one test per story (and per story wrapped).
 *
 * @param source - the source, with its globs.
 * @param options - the framework, and an optional wrapper for a second pass.
 */
export const storyServerTests = (source: StorySource, options: StoryServerTestsOptions): void => {
  const passes: readonly StoryServerPass[] = [
    { name: "alone", render: undefined },
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
          // the stories' own texts: what the catalogue shows when no language is chosen
          const texts = source.texts?.[BASE_LANGUAGE] ?? {};
          let html = "";
          // a render error fails the test: the server does not run error boundaries, and none may be swallowed
          expect(() => {
            html = options.renderer.renderToString({
              story: loaded,
              args: withStoryTexts(loaded.args, storyTextOf(texts)),
              texts,
              // a Live story renders at its start, as the frame's tests picture it (D-504)
              clock: heldFrameClock(loaded.clockStart ?? 0),
              wrap: pass.render
            });
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
