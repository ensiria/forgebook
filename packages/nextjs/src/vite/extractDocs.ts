/**
 * The docs module of a Next.js catalogue: React's, since a Next.js project's components are React components, with the
 * story types a new story file imports being this package's (`forgebook new` writes `@forgebook/nextjs`).
 *
 * @module
 */
import {
  extractCallSites as extractReactCallSites,
  extractFileComponent as extractReactFileComponent,
  extractStoryComponent as extractReactStoryComponent
} from "@forgebook/react/docs";
import type { ExtractCallSites, ExtractFileComponent, ExtractStoryComponent } from "forgebook/vite/adapter";

/** The module a new story file imports its types from. */
export const storyTypesModule = "@forgebook/nextjs";

/** Reads a story file's component, as React's adapter reads it. */
export const extractStoryComponent: ExtractStoryComponent = (storyFile: string) =>
  extractReactStoryComponent(storyFile);

/** Reads a component a file exports, as React's adapter reads it. */
export const extractFileComponent: ExtractFileComponent = (file: string, exportName?: string) =>
  extractReactFileComponent(file, exportName);

/** Finds where the application draws a component, as React's adapter reads it: the values `forgebook new` writes. */
export const extractCallSites: ExtractCallSites = (file: string, name: string) =>
  extractReactCallSites(file, name);
