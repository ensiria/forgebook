/**
 * The types of `forgebook-docs`: what it reads from a package, and its `--json` report.
 *
 * @module
 */
import type { ComponentDocs } from "../../src/componentDocs.ts";

/** One exported function, value or type of a module. */
export type ExportDocs = {
  /** The export's name. */
  readonly name: string;
  /** What it is. */
  readonly kind: "function" | "value" | "type";
  /** A function's parameter names (`?` when optional, `...` when rest). */
  readonly parameters?: readonly string[];
  /** The first paragraph of its TSDoc. */
  readonly summary: string;
};

/** One exported module (a subpath that is not a component). */
export type ModuleDocs = {
  /** The subpath (`./utils/cn`). */
  readonly subpath: string;
  /** Its exports, in the module's order. */
  readonly exports: readonly ExportDocs[];
};

/** One mixin or function of a public Sass module. */
export type SassMemberDocs = {
  /** A mixin or a function. */
  readonly kind: "mixin" | "function";
  /** Its name. */
  readonly name: string;
  /** Its parameter names, without defaults (`$placement`). */
  readonly parameters: readonly string[];
  /** The first line of its `///` comment. */
  readonly summary: string;
};

/** One public Sass module. */
export type SassModuleDocs = {
  /** The subpath (`./scss/focus`). */
  readonly subpath: string;
  /** Its mixins and functions. */
  readonly members: readonly SassMemberDocs[];
};

/** One published style sheet. */
export type StyleSheetDocs = {
  /** The subpath (`./tokens.css`). */
  readonly subpath: string;
  /** The first sentence of its leading comment. */
  readonly summary: string;
};

/** One component with stories. */
export type CatalogueComponent = {
  /** Its stories' title (`Inputs/Selection/Select`). */
  readonly title: string;
  /** The subpath that exports it. */
  readonly subpath: string;
  /** Its docs. */
  readonly docs: ComponentDocs;
  /** Its stories' names. */
  readonly stories: readonly string[];
  /** The export name of its main story (`parameters.main`, else its first); none without stories. */
  readonly mainStory: string | undefined;
  /** Whether every story of its file is about logic (`parameters.logic`): a hook or a function, listed by its call. */
  readonly isLogic: boolean;
};

/** One docs page of the package. */
export type CataloguePage = {
  /** Its title (`Guides/Theming`). */
  readonly title: string;
  /** Its file, relative to the package's folder. */
  readonly file: string;
  /** What it is about, in a sentence; none when it does not say. */
  readonly description: string | undefined;
};

/** Everything `CATALOG.md` lists. */
export type CatalogueData = {
  /** The package's name (`@acme/ui`). */
  readonly packageName: string;
  /** The package's description, from its manifest; none when it has none. */
  readonly description: string | undefined;
  /** The id its stories carry in a catalogue, read from its `./stories` export; none when not written plainly. */
  readonly sourceId: string | undefined;
  /** The components with stories, by title. */
  readonly components: readonly CatalogueComponent[];
  /** The docs pages its source declares, in reading order; none by default. */
  readonly pages?: readonly CataloguePage[];
  /** The other exported modules. */
  readonly modules: readonly ModuleDocs[];
  /** The public Sass modules. */
  readonly sassModules: readonly SassModuleDocs[];
  /** The published style sheets. */
  readonly styleSheets: readonly StyleSheetDocs[];
};

/** The `--json` document. */
export type CatalogueDocsReport = {
  /** `written` / `up-to-date`, or `valid` with `--check`. */
  readonly status: "written" | "up-to-date" | "valid";
  /** The file, relative to the working directory. */
  readonly file: string;
  /** `llms.txt`, beside it, relative to the folder the command runs in. */
  readonly llmsFile: string;
  /** How many components, modules, Sass modules and style sheets it lists. */
  readonly counts: {
    readonly components: number;
    readonly pages: number;
    readonly modules: number;
    readonly sassModules: number;
    readonly styleSheets: number;
  };
  /** Story files that could not be read, with why. */
  readonly problems: readonly string[];
};
