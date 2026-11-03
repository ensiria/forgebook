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
import type { ShellOptions } from "../shellTheme.types.ts";
import type { ViewSwitch } from "../switches.ts";
import type { FrameworkAdapter } from "./adapter.ts";

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
   * after each source's: a name given twice takes the catalogue's value, and tools report the clash.
   */
  readonly tokens?: readonly TokensFile[];
  /** Its preview's path from the configuration's folder; `forgebook.preview.ts` (or `.tsx`) beside it when there. */
  readonly preview?: string;
  /** Tags for every frame's `<head>` (a font's link); none by default. */
  readonly head?: string;
  /** Folders outside the configuration's whose new story files the dev server watches (each source's `src`). */
  readonly watch?: readonly string[];
  /** The libraries' presets, in order; the configuration's own values win over theirs. */
  readonly presets?: readonly ForgebookPreset[];
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
