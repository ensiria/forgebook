/**
 * The contract between the Vite plugin and a framework, on Node: the module that reads a story file's component docs
 * (its props, events and parts), loaded by the docs' worker and by `forgebook-docs`.
 *
 * @remarks
 * Everything else the plugin does is the same for every framework: the story index, the meta's reading
 * (`storyMeta.ts`), the TypeScript programs (`docsProgram.ts`), the worker, the code and the Markdown. A framework
 * package (`@forgebook/react`) exports a docs module (`./docs`) with an `extractStoryComponent` of this type, and an
 * adapter (`./vite`) that names it.
 *
 * @module
 */

import type { ComponentDocs, NoComponentDocs } from "../componentDocs.ts";

/** A story file's component: its docs and the file that declares it. */
export type StoryComponent = {
  /** The component's docs. */
  readonly docs: ComponentDocs;
  /** The absolute path of the file that declares it. */
  readonly file: string;
  /**
   * Every file the docs are read from: the component's and those declaring its own props, so an edit to any of them
   * can renew the docs.
   */
  readonly sources: readonly string[];
};

/** What a framework reads of a story file: its component, `{ docs: { name: null } }` without one, or why it cannot. */
export type StoryComponentResult = StoryComponent | { readonly docs: NoComponentDocs } | string;

/**
 * Reads the component of a story file.
 *
 * @param storyFile - the story file's absolute path.
 */
export type ExtractStoryComponent = (storyFile: string) => StoryComponentResult;

/** A framework, as the plugin uses it. */
export type FrameworkAdapter = {
  /** The framework's name, as `forgebook-docs --framework` writes it (`react`). */
  readonly name: string;
  /** The URL of the module that exports the framework's `extractStoryComponent`, loaded in the docs' worker. */
  readonly docsModule: string;
};

/**
 * Whether a loaded module is a docs module: it exports an `extractStoryComponent` function.
 *
 * @param module - the module, as `import()` gave it.
 */
export const isDocsModule = (
  module: unknown
): module is { readonly extractStoryComponent: ExtractStoryComponent } =>
  typeof module === "object" &&
  module !== null &&
  "extractStoryComponent" in module &&
  typeof module.extractStoryComponent === "function";
