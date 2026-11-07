/**
 * The docs module of `@forgebook/react`: the plugin's worker and `forgebook-docs` load it through the adapter
 * (`forgebook/vite/adapter`). A React component is a function of its props, read as every such framework's is
 * (`forgebook/vite/function-component-docs`): its props from the first parameter's type, events as `on*` props, its
 * parts from its `classNames`, `styles` and `refs` maps.
 *
 * @module
 */
import type { ComponentDocs, NoComponentDocs } from "forgebook/component-docs";
import type { ExtractCallSites, ExtractFileComponent, ExtractStoryComponent } from "forgebook/vite/adapter";
import {
  functionComponentDocs,
  functionFileComponent,
  functionStoryComponent
} from "forgebook/vite/function-component-docs";
import { jsxCallSites } from "forgebook/vite/jsx-call-sites";

/** The module a React story file imports its types from (`Meta`, `Story`), for the stories `forgebook new` writes. */
export const storyTypesModule = "@forgebook/react";

/** Reads a story file's component with the file that declares it. */
export const extractStoryComponent: ExtractStoryComponent = functionStoryComponent;

/** Reads a component a file exports, for writing its first stories (`forgebook new`). */
export const extractFileComponent: ExtractFileComponent = functionFileComponent;

/** Finds where the application draws a component, for the values its first stories take (`forgebook new`). */
export const extractCallSites: ExtractCallSites = jsxCallSites;

/**
 * The docs of a story file's component.
 *
 * @param storyFile - the story file's absolute path.
 * @returns the component's docs, `{ name: null }` when the meta names no component, or a message saying why the file
 * cannot be read.
 */
export const extractComponentDocs = (storyFile: string): ComponentDocs | NoComponentDocs | string =>
  functionComponentDocs(storyFile);
