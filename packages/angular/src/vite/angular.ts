/**
 * Forgebook's adapter for Angular and Analog, for the Vite plugin: `defineConfig({ framework: angular() })`.
 *
 * @remarks
 * Angular's components are compiled by Analog's Vite plugin (`@analogjs/vite-plugin-angular`), ahead of time, as
 * Angular's own build compiles them: decorators, signal inputs and queries, `templateUrl` and `styleUrl`, with the
 * project's `tsconfig.json` and its `angularCompilerOptions`. An Analog application is Angular on that same plugin, so
 * its components need nothing else. A story's own template (written, or a decorator's) is compiled in its frame when
 * it is drawn, by Angular's compiler, which only those frames load (`storyHost.ts`).
 *
 * @module
 */
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";

import type { FrameworkAdapter } from "forgebook/vite/adapter";
import type { PluginOption, UserConfig } from "vite";

import { isCatalogueModule, outsideProgram } from "./outsideProgram.ts";

/** The adapter's options. */
export type AngularOptions = {
  /**
   * The TypeScript configuration the components are compiled with, from the catalogue's folder: the program Angular's
   * compiler reads, so it must include the components (a story file need not be in it). By default `tsconfig.app.json`
   * when there is one, as Angular's CLI and Analog write it, otherwise `tsconfig.json`.
   */
  readonly tsconfig?: string;
  /** The language of the styles written inside the components (`styles: [...]`): `css` by default, or `scss`. */
  readonly inlineStylesExtension?: string;
};

/** The configuration read when none of the others is there. */
const LAST_TSCONFIG = "tsconfig.json";

/** The configurations looked for when none is named, in order. */
const DEFAULT_TSCONFIGS: readonly string[] = ["tsconfig.app.json", LAST_TSCONFIG];

/** The packages a story's frame loads: Angular's own, its compiler on first use, and RxJS, a peer of Angular's core. */
const BROWSER_DEPENDENCIES = [
  "@angular/core",
  "@angular/common",
  "@angular/compiler",
  "@angular/platform-browser",
  "rxjs"
];

/**
 * Angular, as the plugin reads its components: the docs module the docs' worker loads is this package's
 * `extractDocs.ts` (the inputs, outputs and projected content from the types and the decorators); the generated pages
 * draw with its renderer and write code with its template writer; Vite gets Analog's Angular plugin.
 *
 * @param options - the TypeScript configuration and the inline styles' language.
 * @returns the adapter.
 */
export const angular = (options: AngularOptions = {}): FrameworkAdapter => {
  let root = process.cwd();
  return {
    name: "angular",
    // beside this module, with its extension: `.ts` in the sources, `.js` once built for npm
    docsModule: new URL(`./extractDocs${extname(import.meta.url)}`, import.meta.url).href,
    pages: { frame: "@forgebook/angular/frame", code: "@forgebook/angular/code" },
    browserDependencies: BROWSER_DEPENDENCIES,
    // Analog compiles a story file from its own program, without the code that draws an edit in place: edits reload
    redrawsEditedStories: false,
    vitePlugins: async (): Promise<readonly PluginOption[]> => {
      const { default: analog } = await import("@analogjs/vite-plugin-angular");
      const tsconfig = (): string =>
        options.tsconfig ??
        DEFAULT_TSCONFIGS.find((name) => existsSync(resolve(root, name))) ??
        LAST_TSCONFIG;
      const rootOf: PluginOption = {
        name: "forgebook:angular-root",
        enforce: "pre",
        // the catalogue's folder, which a relative configuration is read from
        config: (config: UserConfig): undefined => {
          root = resolve(config.root ?? process.cwd());
          return undefined;
        }
      };
      return [
        rootOf,
        analog({
          tsconfig,
          jit: false,
          // the catalogue's own modules of a story file (`Badge.stories.ts?forgebook-docs`) are not the file: Analog's
          // plugin reads past a query and would put the file's compiled code in their place
          transformFilter: (_code: string, id: string): boolean => !isCatalogueModule(id),
          inlineStylesExtension: options.inlineStylesExtension ?? "css"
        }),
        outsideProgram(() => resolve(root, tsconfig()))
      ];
    }
  };
};
