/**
 * Leads a React story file's imports of Storybook's preview API (`storybook/preview-api`, `@storybook/preview-api`
 * before Storybook 9) to Forgebook's preview hooks, beside the rest of that API.
 *
 * @remarks
 * Storybook's own hooks read a state its preview sets up around every decorator, and throw anywhere else ("Storybook
 * preview hooks can only be called inside decorators and story functions"): a story that calls `useArgs` in a
 * decorator would not draw. The import resolves to a module that exports the hooks that read the story from
 * `@forgebook/react`'s `storybookHooks.ts`, React's for Storybook's `useState` and the rest, and, when the project
 * installs Storybook, everything else of its preview API as it is
 * (`makeDecorator`, `composeStories`): an export named in the module wins over the same name its `export *` brings. The
 * dependency scan sees the real import, so Storybook's module is pre-bundled as before; on a dev server and in a build
 * alike.
 *
 * @module
 */
import type { Plugin } from "vite";

/** Vite's `resolveId` hook, as a function. */
type ResolveIdHook = Extract<NonNullable<Plugin["resolveId"]>, (...args: never[]) => unknown>;

/** A module of an installed package. */
const DEPENDENCY = /[\\/]node_modules[\\/]/;

/** The specifiers of Storybook's preview API: Storybook 9's and the package of the versions before. */
const PREVIEW_API: ReadonlySet<string> = new Set(["storybook/preview-api", "@storybook/preview-api"]);

/**
 * The start of the module's id. Then come, each followed by a colon, whether the project installs Storybook (`with` or
 * `alone`) and the specifier, then the story file that imports it: its Storybook is the one the module re-exports,
 * found from there as the story file's own import would be (a catalogue's folder may not have it).
 */
const MODULE_PREFIX = "\0forgebook-react:storybook-preview-api:";

/** What the module's id says of a project that installs Storybook, and of one that does not. */
const WITH_PACKAGE = "with";
const ALONE = "alone";

/** What a module's id names: the specifier, the story file that imports it, and whether Storybook is there. */
type PreviewApiImport = {
  /** Whether the story file finds Storybook's own preview API. */
  readonly hasPackage: boolean;
  /** The specifier, as the story file writes it. */
  readonly source: string;
  /** The story file. */
  readonly importer: string;
};

/**
 * What a module's id names, or `undefined` when it is not one of this plugin's.
 *
 * @param id - the module's id.
 */
const previewApiImportOf = (id: string): PreviewApiImport | undefined => {
  if (!id.startsWith(MODULE_PREFIX)) return undefined;
  const [flag, source, ...importer] = id.slice(MODULE_PREFIX.length).split(":");
  if (source === undefined || importer.length === 0) return undefined;
  return { hasPackage: flag === WITH_PACKAGE, source, importer: importer.join(":") };
};

/** The hooks the module exports from Forgebook, over Storybook's names: those that read the story. */
const STORY_HOOKS = ["useArgs", "useGlobals", "useParameter", "useStoryContext", "useChannel"] as const;

/**
 * The hooks it exports from React: Storybook's own state and effects, which in a decorator Forgebook draws inside a
 * component are React's.
 */
const REACT_HOOKS = ["useState", "useEffect", "useMemo", "useCallback", "useRef", "useReducer"] as const;

/**
 * The module an import of the preview API resolves to.
 *
 * @param id - the module's id.
 * @returns its code, or `undefined` when the id is not one of this plugin's.
 */
export const previewApiModule = (id: string): string | undefined => {
  const named = previewApiImportOf(id);
  if (named === undefined) return undefined;
  const hooks = [
    `export { ${STORY_HOOKS.join(", ")} } from "@forgebook/react/storybook-hooks";`,
    `export { ${REACT_HOOKS.join(", ")} } from "react";`
  ].join("\n");
  return named.hasPackage ? `export * from ${JSON.stringify(named.source)};\n${hooks}\n` : `${hooks}\n`;
};

/**
 * The plugin.
 *
 * @returns a plugin that runs before Vite's resolver.
 */
export const storybookPreviewApi = (): Plugin => ({
  name: "forgebook:react-storybook-preview-api",
  enforce: "pre",
  async resolveId(
    this: ThisParameterType<ResolveIdHook>,
    source: string,
    importer: string | undefined,
    options: Parameters<ResolveIdHook>[2]
  ): Promise<string | null> {
    // Vite's dependency scan (its untyped `scan` flag) sees Storybook's own module, so it is pre-bundled for this
    // module's import of it; a module of a plugin's is not scanned
    if (!PREVIEW_API.has(source) || importer === undefined || Reflect.get(options, "scan") === true)
      return null;
    // a package's own import (an addon's) stays Storybook's: in a dev server it is pre-bundled, out of this plugin's
    // reach, so a build alike leaves it
    if (DEPENDENCY.test(importer)) return null;
    // the module's own import of Storybook's, found from the story file as its import would be
    const named = previewApiImportOf(importer);
    if (named !== undefined) {
      const own = await this.resolve(source, named.importer, { ...options, skipSelf: true });
      return own?.id ?? null;
    }
    const own = await this.resolve(source, importer, { ...options, skipSelf: true });
    return `${MODULE_PREFIX}${own === null ? ALONE : WITH_PACKAGE}:${source}:${importer}`;
  },
  load: (id: string): string | undefined => previewApiModule(id)
});
