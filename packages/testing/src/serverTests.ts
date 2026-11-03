/**
 * One Vitest test per story: the framework renders it to a string without errors (`renderToString` of its renderer),
 * so no component reads `window` or `document` while rendering, and its controls tell the truth
 * (`storyControlsProblem`).
 *
 * @remarks
 * The stories load through the source's own globs, which Vitest understands. `wrap` puts each story inside a
 * provider (a partial translation catalogue, when the library has one) for a second pass, and can check its HTML. The
 * source's `setup` runs first.
 *
 * @module
 */

import type { StorySource } from "@forgebook/story-format/source";
import { storyTextOf } from "@forgebook/story-format/texts";
import { heldFrameClock } from "forgebook/frame-clock";
import type { StoryDrawing, StoryRenderer } from "forgebook/renderer";
import { sourceFiles } from "forgebook/source-files";
import { type PreparedStory, prepareStory } from "forgebook/story-hooks";
import {
  type LoadedDecorator,
  type LoadedPreview,
  type LoadedStory,
  mergedPreviews,
  readPreview,
  readStory,
  startingGlobals
} from "forgebook/story-module";
import { BASE_LANGUAGE, withStoryTexts } from "forgebook/story-texts";
import { storyTree, testedStoryLocations } from "forgebook/story-tree";
import { beforeAll, describe, expect, it } from "vitest";

import { storyControlsProblem } from "./storyControls.ts";

/** A second pass: each story inside a decorator, its HTML optionally checked. */
export type StoryServerPass = {
  /** The pass's name, in each test's title (`partial catalogue`). */
  readonly name: string;
  /**
   * The decorator the story is drawn in (`(story) => <Provider messages={partial}>{story()}</Provider>`), outside its
   * own; none draws it alone.
   */
  readonly decorator: LoadedDecorator | undefined;
  /** Checks the story's HTML, with Vitest's `expect` (no message key shown, for a partial catalogue); none by default. */
  readonly check?: (html: string) => void;
};

/** The generated tests' options. */
export type StoryServerTestsOptions = {
  /** The framework that draws the stories (`reactRenderer` of `@forgebook/react`). */
  readonly renderer: StoryRenderer;
  /** The catalogue's previews' modules (its presets' first), whose decorators and parameters every story gets. */
  readonly previews?: readonly unknown[];
  /** A second pass over every story. */
  readonly wrap?: StoryServerPass;
};

/**
 * A story of a source, loaded.
 *
 * @param source - the source.
 * @param file - the story's file, as the source keys it.
 * @param exportName - the story's export.
 * @param preview - the previews it is read under; none reads it alone.
 * @throws when the file has no loader or the story cannot be read.
 */
const loadedStory = async (
  source: StorySource,
  file: string,
  exportName: string,
  preview?: LoadedPreview
): Promise<LoadedStory> => {
  const load = sourceFiles(source).stories[file];
  if (load === undefined) throw new Error(`No loader for ${file}`);
  const loaded = readStory(await load(), exportName, preview);
  if (typeof loaded === "string") throw new Error(loaded);
  return loaded;
};

/**
 * A story's HTML. A render error fails the test: the server does not run error boundaries, and none may be swallowed.
 *
 * @param renderer - the framework.
 * @param prepared - the story's set-ups, undone after it, whether it drew or not.
 * @param drawing - the story.
 */
const renderedHtml = async (
  renderer: StoryRenderer,
  prepared: PreparedStory,
  drawing: StoryDrawing
): Promise<string> => {
  try {
    return await renderer.renderToString(drawing);
  } finally {
    await prepared.cleanup();
  }
};

/**
 * Declares the tests, one `describe` per component and one test per story (and per story wrapped).
 *
 * @param source - the source, with its globs.
 * @param options - the framework, and an optional wrapper for a second pass.
 */
export const storyServerTests = (source: StorySource, options: StoryServerTestsOptions): void => {
  const passes: readonly StoryServerPass[] = [
    { name: "alone", decorator: undefined },
    ...(options.wrap === undefined ? [] : [options.wrap])
  ];
  const preview = mergedPreviews((options.previews ?? []).map(readPreview));
  beforeAll(async () => {
    await source.setup?.();
    await preview.setup?.();
  });
  const locations = testedStoryLocations(storyTree([source]));
  for (const [title, entries] of Map.groupBy(locations, (location) => location.component.title)) {
    describe(title, () => {
      for (const { story, component } of entries) {
        it.each(passes)(`${story.name} renders on the server ($name)`, async (pass) => {
          const loaded = await loadedStory(source, story.file, story.exportName, preview);
          // the stories' own texts: what the catalogue shows when no language is chosen
          const texts = source.texts?.[BASE_LANGUAGE] ?? {};
          const args = withStoryTexts(loaded.args, storyTextOf(texts));
          // a Live story renders at its start, as the frame's tests picture it
          const clock = heldFrameClock(loaded.clockStart ?? 0);
          // the loaders and set-ups run as in the frame, so a story drawn from what they load renders here too
          const identity = { id: story.id, name: story.name, title: component.title };
          // the globals the frame starts the story with, so a decorator reading its preview's default reads it here too
          const globals = startingGlobals(preview, loaded);
          const prepared = await prepareStory(loaded, {
            ...identity,
            args,
            text: storyTextOf(texts),
            clock,
            globals,
            parameters: loaded.parameters
          });
          const html = await renderedHtml(options.renderer, prepared, {
            identity,
            story: loaded,
            args,
            texts,
            clock,
            decorators: [...preview.decorators, ...(pass.decorator === undefined ? [] : [pass.decorator])],
            globals,
            loaded: prepared.loaded
          });
          pass.check?.(html);
        });
        it(`${story.name} declares the controls it uses`, async () => {
          const loaded = await loadedStory(source, story.file, story.exportName);
          expect(storyControlsProblem(loaded)).toBeUndefined();
        });
      }
    });
  }
};
