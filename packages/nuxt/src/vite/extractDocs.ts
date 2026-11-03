/**
 * The docs module of a Nuxt catalogue: Vue's, since a Nuxt project's components are Vue components, with the story types
 * a new story file imports being this package's (`forgebook new` writes `@forgebook/nuxt`).
 *
 * @module
 */
import {
  extractFileComponent as extractVueFileComponent,
  extractStoryComponent as extractVueStoryComponent,
  sourcesChanged as vueSourcesChanged,
  storyFileShape as vueStoryFileShape
} from "@forgebook/vue/docs";
import type { ExtractFileComponent, ExtractStoryComponent, StoryFileShape } from "forgebook/vite/adapter";

/** The module a new story file imports its types from. */
export const storyTypesModule = "@forgebook/nuxt";

/** Reads a story file's component, as Vue's adapter reads it. */
export const extractStoryComponent: ExtractStoryComponent = (storyFile: string) =>
  extractVueStoryComponent(storyFile);

/** Reads a component a file exports, as Vue's adapter reads it. */
export const extractFileComponent: ExtractFileComponent = (file: string, exportName?: string) =>
  extractVueFileComponent(file, exportName);

/**
 * How `forgebook new` writes a component's stories: as Vue's adapter writes them.
 *
 * @param name - the component's name.
 * @param file - the component's file, absolute.
 */
export const storyFileShape = (name: string, file: string): StoryFileShape => vueStoryFileShape(name, file);

/** The worker heard that a source changed: Vue's checkers read again on their next read. */
export const sourcesChanged = (): void => vueSourcesChanged();
