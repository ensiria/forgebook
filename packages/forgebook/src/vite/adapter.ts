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

import type { PluginOption } from "vite";

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
  /**
   * The browser modules the generated pages import, as specifiers the catalogue's folder resolves: the frame page's
   * (`mountFrame` with the framework's renderer) and the code writer the shell writes a story's code with
   * (`storyJsx`).
   */
  readonly pages: {
    /** The module exporting the framework's `mountFrame` (`@forgebook/react/frame`). */
    readonly frame: string;
    /** The module exporting the framework's code writer as `codeOf` (`@forgebook/react/code`). */
    readonly code: string;
  };
  /**
   * The packages the framework's pages import in the browser (`react-dom/client`): pre-bundled before the first page
   * opens, since Vite's scanner cannot read pages that are generated; none by default.
   */
  readonly browserDependencies?: readonly string[];
  /** The Vite plugins the framework needs in a catalogue (React's Fast Refresh); none by default. */
  readonly vitePlugins?: () => Promise<readonly PluginOption[]>;
};

/** Reads the component a file exports (`forgebook new`): the export named, or the file's only component. */
export type ExtractFileComponent = (file: string, exportName?: string) => StoryComponentResult;

/** A framework's docs module, as the plugin and the commands load it. */
export type DocsModule = {
  /** Reads a story file's component. */
  readonly extractStoryComponent: ExtractStoryComponent;
  /** Reads a component a file exports; none in a framework package that does not offer it yet. */
  readonly extractFileComponent?: ExtractFileComponent;
  /** The module a story file imports its types from (`@forgebook/react`); none when not given. */
  readonly storyTypesModule?: string;
};

/**
 * Whether a module is a framework's docs module.
 *
 * @param module - the module, as `import()` gave it.
 */
export const isDocsModule = (module: unknown): module is DocsModule =>
  typeof module === "object" &&
  module !== null &&
  "extractStoryComponent" in module &&
  typeof module.extractStoryComponent === "function" &&
  (!("extractFileComponent" in module) || typeof module.extractFileComponent === "function") &&
  (!("storyTypesModule" in module) || typeof module.storyTypesModule === "string");
