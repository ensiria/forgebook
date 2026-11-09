/**
 * A catalogue's configuration, as `forgebook.config.ts` writes it (`export default defineConfig({ … })`), and a
 * library's preset, as its package ships it (`definePreset`).
 *
 * @remarks
 * The configuration is read on Node, by the Vite plugin and the `forgebook` command: data only, plus the framework's
 * adapter. What runs in the frames (decorators, providers, a setup) is the preview's (`forgebook.preview.ts`), named
 * here by its path. A preset is the same data a library gives every catalogue that shows it (its switches, its
 * languages, its preview); the catalogue's own configuration wins over its presets' (O2).
 *
 * @module
 */

import type { StoryLanguage, StoryTokensFile } from "@forgebook/story-format/source";

import type { CatalogueLists } from "../catalogue.ts";
import type { ForgebookPlugin } from "../plugin.ts";
import type { ShellOptions } from "../shellTheme.types.ts";
import type { ViewSwitch } from "../switches.ts";
import type { FrameworkAdapter } from "./adapter.ts";
import type { AppBuildOption } from "./appBuildOption.ts";
import type { FramesOption } from "./framesConfig.ts";

/** What a library's preset gives a catalogue. */
export type ForgebookPreset = CatalogueLists & {
  /** The preset's name, in a problem's message (`acme-ui`). */
  readonly name: string;
  /** The switches it declares, before the catalogue's. */
  readonly switches?: readonly ViewSwitch[];
  /** The languages its stories can be drawn in, before the catalogue's. */
  readonly languages?: readonly StoryLanguage[];
  /** The absolute path of its preview module (decorators, parameters, a setup), under the catalogue's. */
  readonly preview?: string;
  /** Tags for every frame's `<head>`, before the catalogue's. */
  readonly head?: string;
  /** The shell's look, under the catalogue's: its theme, and a style sheet by absolute path. */
  readonly shell?: ShellOptions;
  /**
   * Custom controls of the props panel it brings to every catalogue that lists it, by name, each module by absolute path
   * or a package's specifier: a catalogue's registration of the same name replaces it. They run in the catalogue's page
   * with a plugin's trust, as the catalogue's own do.
   */
  readonly argControls?: Readonly<Record<string, string | ArgControlOption>>;
  /**
   * Plugins it brings to every catalogue that lists it, before the catalogue's own: a library's tab or frame module,
   * with no line in each catalogue. Their modules are specifiers the catalogue's folder resolves, so a preset names them
   * by absolute path or by a package the catalogue installs. A catalogue's plugin of the same id replaces one, and
   * `presetPlugins: { <id>: false }` leaves one out.
   */
  readonly plugins?: readonly ForgebookPlugin[];
};

/**
 * Which props a custom control takes without a story naming it: each field given must hold, so `{ typeName, propName }`
 * takes only that prop of that type.
 */
export type ArgControlMatch = {
  /**
   * The type's name as the props are read: as the source writes it (`IconComponent`), or any alias it is declared
   * through (`type ButtonIcon = IconComponent`), without `undefined` and `null`; a union only when every member goes by it.
   */
  readonly typeName?: string;
  /** The prop's name (`icon`). */
  readonly propName?: string;
};

/** A custom control with more than its module: its frame module, and the props it takes on its own. */
export type ArgControlOption = {
  /** The module the panel draws it with, exporting `mount` and `schema`. */
  readonly module: string;
  /**
   * A module of the stories' frames exporting `toStoryValue(value, argType)`, which turns the panel's JSON value into
   * what the story receives (a name into an icon); none gives the story the JSON value.
   */
  readonly frame?: string;
  /**
   * The props it is the control of in every story that names no control for them, by type or by name; one or a list,
   * of which any may match. A match by name wins over one by type, then the catalogue's controls over its presets'.
   */
  readonly matches?: ArgControlMatch | readonly ArgControlMatch[];
};

/** A tokens file: its path from the configuration's folder, with its theme when it is a theme's. */
export type TokensFile = StoryTokensFile;

/** A catalogue's configuration: the lists of `CatalogueLists` (widths, backgrounds, story groups…) besides these. */
export type ForgebookConfig = CatalogueLists & {
  /** The framework its stories are written for (`react()` of `@forgebook/react/vite`). */
  readonly framework: FrameworkAdapter;
  /** Its name, in the page's title and the sidebar. */
  readonly title: string;
  /**
   * Its logo: a square image, by path from the configuration's folder; Forgebook's own mark by default, or its title
   * alone with `shell: { branding: false }`.
   */
  readonly logo?: string;
  /** The stories' measured heights, the file `forgebook-heights` writes, served from the public folder; none by default. */
  readonly heights?: string;
  /**
   * The project's own story files, as globs from the configuration's folder (`["src/**\/*.stories.tsx"]`): one source
   * named after the catalogue. Give `stories` or `sources`, or both.
   */
  readonly stories?: readonly string[];
  /**
   * The project's own docs pages, as globs from the configuration's folder (`["docs/**\/*.md"]`): Markdown with live
   * stories, listed in the sidebar's Docs section, in the source named after the catalogue.
   */
  readonly docs?: readonly string[];
  /**
   * The catalogue's home, written by its authors: a Markdown file by path from the configuration's folder, read with
   * the docs pages' syntax, with values (`{{components}}`) and pieces of the generated home (`::families`).
   * `forgebook.home.md` beside the configuration when there; without either, or with `false`, the home is generated.
   */
  readonly home?: string | false;
  /** The packages' story sources, as module specifiers exporting a `source` (`["@acme/ui/stories"]`). */
  readonly sources?: readonly string[];
  /** The switches of the toolbar and the View menu; the theme and the contrast when neither it nor a preset declares any. */
  readonly switches?: readonly ViewSwitch[];
  /** The languages its stories can be drawn in; none turns the Language row off. */
  readonly languages?: readonly StoryLanguage[];
  /** The shell's look: a theme of colours, fonts and corners, an escape hatch, and whether Forgebook's mark shows. */
  readonly shell?: ShellOptions;
  /**
   * Its design tokens, DTCG 2025.10 files by path from the configuration's folder, the base first; a theme is a file of
   * its own (`["tokens.json", { file: "dark.tokens.json", mode: "dark" }]`). What tools and agents read tokens from,
   * after each source's: a name given twice takes the catalogue's value, and tools report the clash. With none named here
   * or on a source, what the application already declares is read instead (custom properties, Tailwind, `components.json`);
   * `[]` says there is no system, so nothing is.
   */
  readonly tokens?: readonly TokensFile[];
  /**
   * Custom controls of the props panel, by the name a story's `argTypes` use (`{ rating: "./controls/rating.ts" }`): each a
   * module, by path from the configuration's folder or a package's specifier, exporting `mount` and `schema`, or an
   * `ArgControlOption` with a frame module and the props it matches. It loads when a story's panel shows it, and runs in
   * the shell's page with a plugin's trust. A name its presets register is replaced; `false` removes theirs.
   */
  readonly argControls?: Readonly<Record<string, string | ArgControlOption | false>>;
  /** Its preview's path from the configuration's folder; `forgebook.preview.ts` (or `.tsx`) beside it when there. */
  readonly preview?: string;
  /** Tags for every frame's `<head>` (a font's link); none by default. */
  readonly head?: string;
  /** Folders outside the configuration's whose new story files the dev server watches (each source's `src`). */
  readonly watch?: readonly string[];
  /** The libraries' presets, in order; the configuration's own values win over theirs. */
  readonly presets?: readonly ForgebookPreset[];
  /**
   * The plugins, in order (`[figma()]`): a package adds nothing to the catalogue until it is listed here or by a preset.
   * A plugin listed here replaces a preset's of the same id.
   */
  readonly plugins?: readonly ForgebookPlugin[];
  /** The presets' plugins left out, by id (`{ acme: false }`); naming one no preset brings stops the catalogue. */
  readonly presetPlugins?: Readonly<Record<string, false>>;
  /**
   * Where the stories' frames run. On the dev server, an origin of their own by default (the catalogue's port + 1), so
   * a story's code cannot reach the catalogue's page, its agent API or the project's files; a build keeps the
   * catalogue's origin unless `origins` names a second host. `"same-origin"` runs them on the catalogue's origin.
   */
  readonly frames?: FramesOption;
  /** How `forgebook build` writes the catalogue. */
  readonly build?: BuildOptions;
  /**
   * How much of the app's own build its stories are drawn with: `tsconfig.json`'s `paths`, the `vite.config` beside this
   * file (its aliases, its plugins except the framework's and those only an app's build needs) and its PostCSS. All by
   * default; loading a `vite.config` or a `postcss.config` runs its code, as the app's build does. `false` reads none,
   * and each part can be turned off.
   */
  readonly appBuild?: AppBuildOption;
  /**
   * Other catalogues, built and deployed, shown in the sidebar after this one's stories, by an id of lower-case words
   * (`{ "design-system": { title: "Design system", url: "https://ds.example.com/" } }`). Each is read from the index
   * its `forgebook build --agent-index` writes, when its section is first opened, and its stories are drawn by its own
   * page on its own origin, read-only, with this catalogue's switches. Its host must let this catalogue fetch the index
   * (CORS) and frame its page. None by default.
   */
  readonly refs?: Readonly<Record<string, RefOption>>;
};

/** A catalogue shown in another's sidebar (`refs`). */
export type RefOption = {
  /** Its name, as its section's heading. */
  readonly title: string;
  /** The address it is served at, its folder (`https://ds.example.com/catalogue/`). */
  readonly url: string;
};

/** How `forgebook build` writes the catalogue. */
export type BuildOptions = {
  /**
   * Whether each script a build writes is named after its module as well as its hash (`assets/Button-3f9a1c2b.js`), for
   * whoever reads a build's files; `false` by default: its hash alone (`assets/3f9a1c2b.js`), since a catalogue names
   * each story file's scripts once per loader, and the names are a tenth of what its index weighs.
   * `forgebook build --readable-names` turns it on for one build.
   */
  readonly readableNames?: boolean;
};

/**
 * A catalogue's configuration, typed: what `forgebook.config.ts` exports by default.
 *
 * @param config - the configuration.
 */
export const defineConfig = (config: ForgebookConfig): ForgebookConfig => config;

/**
 * A library's preset, typed: what its package's `./forgebook` export returns.
 *
 * @param preset - the preset.
 */
export const definePreset = (preset: ForgebookPreset): ForgebookPreset => preset;
