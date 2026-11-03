/**
 * The docs module of a SvelteKit catalogue: Svelte's, since a SvelteKit project's components are Svelte components,
 * with the story types a new story file imports being this package's (`forgebook new` writes `@forgebook/sveltekit`).
 *
 * @module
 */
import {
  extractFileComponent as extractSvelteFileComponent,
  extractStoryComponent as extractSvelteStoryComponent,
  storyFileShape as svelteStoryFileShape
} from "@forgebook/svelte/docs";
import type { ExtractFileComponent, ExtractStoryComponent, StoryFileShape } from "forgebook/vite/adapter";

/** The module a new story file imports its types from. */
export const storyTypesModule = "@forgebook/sveltekit";

/** Reads a story file's component, as Svelte's adapter reads it. */
export const extractStoryComponent: ExtractStoryComponent = (storyFile: string) =>
  extractSvelteStoryComponent(storyFile);

/** Reads a component a file exports, as Svelte's adapter reads it. */
export const extractFileComponent: ExtractFileComponent = (file: string, exportName?: string) =>
  extractSvelteFileComponent(file, exportName);

/**
 * How a component's stories file is written, as Svelte's adapter writes it.
 *
 * @param name - the component's name.
 * @param file - the component's file, absolute.
 */
export const storyFileShape = (name: string, file: string): StoryFileShape =>
  svelteStoryFileShape(name, file);
