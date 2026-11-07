/**
 * The keys a catalogue's configuration and a library's preset may have, and what to say of one they may not.
 *
 * @remarks
 * A configuration is code nobody type-checked against this version, and a misspelt key is otherwise read as a value left
 * out: `toolbr: […]` gives the default toolbar, with no word of why. Nothing can add a key: an adapter's and a plugin's
 * options are the arguments of their own functions (`react({ … })`, `figma({ … })`), and both reach the catalogue as one
 * value of `framework` and `plugins`. So the lists are closed, and written as records of the types' own keys: a key added
 * to a type without being added here does not compile.
 *
 * The objects read here by key (`build`, `appBuild`, `shell`, `a11y`, `backgrounds`, `widthRange`, `controls`) are checked one level
 * down, and each of `refs` by its id. `tabs` is not, since a plugin adds to its names; a device's fields have their own check (`configFile.ts`), and a
 * theme's values theirs (`shellTheme.ts`).
 *
 * @module
 */
import { didYouMean } from "@ensiria/cli-kit/suggest";

import { type CatalogueLists, OWN_CONTROL_IDS, type TurnedOffControl } from "../catalogue.ts";
import type { ShellOptions } from "../shellTheme.types.ts";
import type { AppBuildOption } from "./appBuildOption.ts";
import type { BuildOptions, ForgebookConfig, ForgebookPreset, RefOption } from "./config.ts";

/** A type's keys, as a record so that the compiler keeps it complete. */
type KeysOf<TType> = Readonly<Record<keyof Required<TType>, true>>;

/** What a catalogue's configuration and a preset share. */
const LIST_KEYS: KeysOf<CatalogueLists> = {
  id: true,
  widths: true,
  widthRange: true,
  zooms: true,
  textSizes: true,
  backgrounds: true,
  storyGroups: true,
  tabs: true,
  a11y: true,
  gridStep: true,
  strings: true,
  keys: true,
  controls: true,
  toolbar: true,
  usedIn: true,
  play: true,
  componentDocs: true,
  audience: true,
  appearance: true,
  propGroups: true,
  requiredFirst: true,
  views: true,
  device: true,
  statuses: true
};

/** A configuration's keys. */
const CONFIG_KEYS: KeysOf<ForgebookConfig> = {
  ...LIST_KEYS,
  framework: true,
  title: true,
  logo: true,
  heights: true,
  stories: true,
  docs: true,
  home: true,
  sources: true,
  switches: true,
  languages: true,
  shell: true,
  tokens: true,
  argControls: true,
  preview: true,
  head: true,
  watch: true,
  presets: true,
  plugins: true,
  frames: true,
  build: true,
  appBuild: true,
  refs: true
};

/** A preset's keys. */
const PRESET_KEYS: KeysOf<ForgebookPreset> = {
  ...LIST_KEYS,
  name: true,
  switches: true,
  languages: true,
  preview: true,
  head: true,
  shell: true
};

const BUILD_KEYS: KeysOf<BuildOptions> = { readableNames: true };

const APP_BUILD_KEYS: KeysOf<Exclude<AppBuildOption, false>> = {
  viteConfig: true,
  tsconfigPaths: true,
  postcss: true,
  skipPlugins: true,
  keepPlugins: true
};

const SHELL_KEYS: KeysOf<ShellOptions> = { theme: true, css: true, branding: true };

const REF_KEYS: KeysOf<RefOption> = { title: true, url: true };

const A11Y_KEYS: KeysOf<Exclude<NonNullable<CatalogueLists["a11y"]>, false>> = {
  tags: true,
  disabledRules: true
};

const BACKGROUND_KEYS: KeysOf<NonNullable<CatalogueLists["backgrounds"]>> = { builtIn: true, custom: true };

const WIDTH_RANGE_KEYS: KeysOf<NonNullable<CatalogueLists["widthRange"]>> = { min: true, max: true };

/** What `controls` can turn off, Forgebook's own controls first. */
const TURNED_OFF_CONTROLS: readonly TurnedOffControl[] = [...OWN_CONTROL_IDS, "direction", "touch", "embed"];

/** The objects of a configuration or a preset whose keys are known too, by the key that holds them. */
const NESTED_KEYS: Readonly<Record<string, readonly string[]>> = {
  build: Object.keys(BUILD_KEYS),
  appBuild: Object.keys(APP_BUILD_KEYS),
  shell: Object.keys(SHELL_KEYS),
  a11y: Object.keys(A11Y_KEYS),
  backgrounds: Object.keys(BACKGROUND_KEYS),
  widthRange: Object.keys(WIDTH_RANGE_KEYS),
  controls: TURNED_OFF_CONTROLS
};

/**
 * What to say of the keys of an object that are none of the known ones.
 *
 * @param value - the object.
 * @param known - its keys.
 * @param prefix - where it is, written before a key's name (`build.`); empty at the top.
 */
const unknownKeys = (value: object, known: readonly string[], prefix: string): string[] =>
  Object.keys(value)
    .filter((key) => !known.includes(key))
    .map((key) => {
      const named = didYouMean(key, known).trim();
      return `it has no key "${prefix}${key}". ${named === "" ? `It takes ${known.join(", ")}.` : named}`;
    });

/** Whether a value is an object that is not a list. */
const isObject = (value: unknown): value is object =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * What to say of the keys of each composed catalogue, which `refs` holds by id.
 *
 * @param refs - the configuration's `refs`.
 */
const refsKeysProblems = (refs: unknown): string[] =>
  isObject(refs)
    ? Object.entries(refs).flatMap(([id, ref]: [string, unknown]) =>
        isObject(ref) ? unknownKeys(ref, Object.keys(REF_KEYS), `refs.${id}.`) : []
      )
    : [];

/**
 * What to say of the keys of a configuration or a preset, one level down included.
 *
 * @param value - the object.
 * @param known - its keys.
 */
const keysProblems = (value: object, known: readonly string[]): string[] => [
  ...unknownKeys(value, known, ""),
  ...Object.entries(NESTED_KEYS).flatMap(([key, keys]) => {
    const nested: unknown = Reflect.get(value, key);
    return isObject(nested) ? unknownKeys(nested, keys, `${key}.`) : [];
  }),
  ...refsKeysProblems(Reflect.get(value, "refs"))
];

/**
 * Why a loaded configuration holds a key no version of it reads, its presets' included, or none: every such key, so that
 * one run shows them all.
 *
 * @param config - what the file exports by default.
 */
export const unknownKeysProblem = (config: object): string | undefined => {
  const presets: unknown = Reflect.get(config, "presets");
  const problems = [
    ...keysProblems(config, Object.keys(CONFIG_KEYS)),
    ...(Array.isArray(presets) ? presets : []).flatMap((preset: unknown): string[] => {
      if (typeof preset !== "object" || preset === null) return [];
      const name: unknown = Reflect.get(preset, "name");
      return keysProblems(preset, Object.keys(PRESET_KEYS)).map(
        (problem) => `its preset "${String(name)}": ${problem}`
      );
    })
  ];
  return problems.length === 0 ? undefined : problems.join(" ");
};

/**
 * Whether a configuration says it has no design system (`tokens: []`), which leaving the key out does not.
 *
 * @param config - the configuration.
 */
export const saysNoTokens = ({ tokens }: { readonly tokens?: readonly unknown[] }): boolean =>
  tokens?.length === 0;
