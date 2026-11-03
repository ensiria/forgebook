/**
 * The docs module of `@forgebook/preact`: the plugin's worker and `forgebook-docs` load it through the adapter
 * (`forgebook/vite/adapter`). A Preact component is a function of its props, read as every such framework's is
 * (`forgebook/vite/function-component-docs`): its props from the first parameter's type, events as `on*` props, its
 * parts from its `classNames`, `styles` and `refs` maps.
 *
 * @module
 */
import type { ComponentDocs, NoComponentDocs } from "forgebook/component-docs";
import type { ExtractFileComponent, ExtractStoryComponent } from "forgebook/vite/adapter";
import {
  functionComponentDocs,
  functionFileComponent,
  functionStoryComponent
} from "forgebook/vite/function-component-docs";

/** The module a Preact story file imports its types from (`Meta`, `Story`), for the stories `forgebook new` writes. */
export const storyTypesModule = "@forgebook/preact";

/** Reads a story file's component with the file that declares it. */
export const extractStoryComponent: ExtractStoryComponent = functionStoryComponent;

/** Reads a component a file exports, for writing its first stories (`forgebook new`). */
export const extractFileComponent: ExtractFileComponent = functionFileComponent;

/**
 * The docs of a story file's component.
 *
 * @param storyFile - the story file's absolute path.
 * @returns the component's docs, `{ name: null }` when the meta names no component, or a message saying why the file
 * cannot be read.
 */
export const extractComponentDocs = (storyFile: string): ComponentDocs | NoComponentDocs | string =>
  functionComponentDocs(storyFile);
