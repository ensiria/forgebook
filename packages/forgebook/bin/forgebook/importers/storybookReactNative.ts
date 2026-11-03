/**
 * What `forgebook init --from storybook` reads of a React Native project's Storybook: the options of Storybook's React
 * Native Web framework or of its older addon, turned into `reactNativeWeb()`'s, and what on-device Storybook draws
 * differently in a browser.
 *
 * @remarks
 * Pure: the options `main` gives in, the adapter's options and the notes out; `storybookFrameworks.ts` chooses the
 * framework and hands them over. The packages Storybook compiled (`modulesToTranspile`) become `nativePackages`; its
 * `pluginReactOptions` (the JSX import source, Babel's plugins and presets, the files) become the adapter's options of
 * the same meaning; what cannot be written as a plain value (a function, a regular expression) is named in a note.
 *
 * @module
 */

/** Storybook's React Native framework for the browser, on Vite. */
export const REACT_NATIVE_WEB_VITE = "@storybook/react-native-web-vite";

/** Storybook's older React Native Web addon, on webpack, beside a React framework. */
export const REACT_NATIVE_WEB_ADDON = "@storybook/addon-react-native-web";

/** On-device Storybook's package, which `main` names as its framework or not at all. */
export const ON_DEVICE_STORYBOOK = "@storybook/react-native";

/** What the React Native Web adapter's options take from the project, and what was not read. */
export type ReactNativeImport = {
  /** The adapter's options, plain values written into the configuration; none for the defaults. */
  readonly options: Readonly<Record<string, unknown>> | undefined;
  /** What was not read, each a sentence for the person who runs the command. */
  readonly notes: readonly string[];
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Options read from Storybook, written into the configuration, with what could not be. */
type ReadOptions = {
  /** The options, plain values. */
  readonly options: Readonly<Record<string, unknown>>;
  /** What was left out, each a sentence. */
  readonly notes: readonly string[];
};

/**
 * A value read as a list: a list as it is, nothing as none, anything else as a list of itself.
 *
 * @param value - the value.
 */
const listOf = (value: unknown): readonly unknown[] => {
  if (Array.isArray(value)) return value;
  return value === undefined ? [] : [value];
};

/**
 * The texts of a list, with a note when it holds something else (a function, a regular expression), which cannot be
 * written as a plain value.
 *
 * @param value - the list, as `main` writes it.
 * @param field - its name, for the note.
 */
const texts = (value: unknown, field: string): { readonly values: string[]; readonly notes: string[] } => {
  const list = listOf(value);
  const values = list.filter((item) => typeof item === "string");
  const notes =
    values.length === list.length ? [] : [`${field}: only names are written; copy the others by hand`];
  return { values, notes };
};

/**
 * Whether a value is written as it is in JSON: texts, finite numbers, booleans, `null`, and lists and objects of them.
 *
 * @param value - the value.
 */
const isPlain = (value: unknown): boolean => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isPlain);
  return (
    isRecord(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.values(value).every(isPlain)
  );
};

/**
 * Babel's plugins or presets as the configuration writes them: a name, or a name and plain options.
 *
 * @param value - the list, as `main` writes it.
 * @param field - its name, for the note.
 */
const babelItems = (
  value: unknown,
  field: string
): { readonly values: unknown[]; readonly notes: string[] } => {
  const list = Array.isArray(value) ? value : [];
  const values = list.filter(
    (item) =>
      typeof item === "string" ||
      (Array.isArray(item) &&
        item.length === 2 &&
        typeof item[0] === "string" &&
        isRecord(item[1]) &&
        isPlain(item[1]))
  );
  const notes =
    values.length === list.length
      ? []
      : [
          `${field}: an item that is not a name, or a name with plain options (a function, a regular expression, a third element), is not written; copy it by hand`
        ];
  return { values, notes };
};

/**
 * The notes on Storybook options that are not read at all: the deprecated `pluginBabelOptions`, and a `babel` that is
 * not a plain object.
 *
 * @param options - the framework's options.
 * @param react - its `pluginReactOptions`.
 */
const shapeNotes = (
  options: Readonly<Record<string, unknown>>,
  react: Readonly<Record<string, unknown>>
): string[] => {
  const notes: string[] = [];
  if (options["pluginBabelOptions"] !== undefined)
    notes.push(
      "pluginBabelOptions is not read (Storybook no longer reads it either): name Babel's plugins in babel"
    );
  if (react["babel"] !== undefined && !isRecord(react["babel"]))
    notes.push(
      "pluginReactOptions.babel is not a plain object: copy its plugins and presets into babel by hand"
    );
  return notes;
};

/**
 * `reactNativeWeb()`'s options from a Storybook React Native framework's: `modulesToTranspile` as `nativePackages`,
 * `pluginReactOptions`' JSX import source, Babel plugins and presets, and files.
 *
 * @param options - the framework's or the addon's options.
 */
const reactNativeWebOptions = (options: Readonly<Record<string, unknown>>): ReadOptions => {
  const react = isRecord(options["pluginReactOptions"]) ? options["pluginReactOptions"] : {};
  const babel = isRecord(react["babel"]) ? react["babel"] : {};
  const nativePackages = texts(options["modulesToTranspile"], "modulesToTranspile");
  // the older addon names its Babel plugins beside its options
  const plugins = babelItems(babel["plugins"] ?? options["babelPlugins"], "babel.plugins");
  const presets = babelItems(babel["presets"], "babel.presets");
  const include = texts(react["include"], "pluginReactOptions.include");
  const exclude = texts(react["exclude"], "pluginReactOptions.exclude");
  const jsxImportSource = react["jsxImportSource"];
  const notes = [
    ...shapeNotes(options, react),
    ...nativePackages.notes,
    ...plugins.notes,
    ...presets.notes,
    ...include.notes,
    ...exclude.notes,
    ...(react["jsxRuntime"] === "classic"
      ? ["jsxRuntime classic is not read: JSX is compiled for the automatic runtime"]
      : [])
  ];
  const written: Record<string, unknown> = {
    ...(nativePackages.values.length === 0 ? {} : { nativePackages: nativePackages.values }),
    ...(typeof jsxImportSource === "string" && jsxImportSource !== "react" ? { jsxImportSource } : {}),
    ...(plugins.values.length === 0 && presets.values.length === 0
      ? {}
      : {
          babel: {
            ...(plugins.values.length === 0 ? {} : { plugins: plugins.values }),
            ...(presets.values.length === 0 ? {} : { presets: presets.values })
          }
        }),
    ...(include.values.length === 0 ? {} : { include: include.values }),
    ...(exclude.values.length === 0 ? {} : { exclude: exclude.values })
  };
  return { options: written, notes };
};

/**
 * What a React Native project's Storybook gives `reactNativeWeb()`.
 *
 * @param storybook - the Storybook package read: the framework on Vite, the older addon, or on-device Storybook.
 * @param options - that framework's or addon's options.
 * @param main - `main`'s configuration, for on-device Storybook's device addons.
 */
export const importReactNative = (
  storybook: string,
  options: Readonly<Record<string, unknown>>,
  main: Readonly<Record<string, unknown>>
): ReactNativeImport => {
  if (storybook === ON_DEVICE_STORYBOOK)
    return {
      options: undefined,
      notes: [
        "On-device Storybook: the stories are drawn in the browser through react-native-web, so a component that needs a native module does not draw",
        ...(main["deviceAddons"] === undefined
          ? []
          : ["The device addons are left out: Forgebook has its own panel"])
      ]
    };
  const read = reactNativeWebOptions(options);
  const written = Object.keys(read.options).length === 0 ? undefined : read.options;
  return storybook === REACT_NATIVE_WEB_ADDON
    ? {
        options: written,
        notes: [
          `${REACT_NATIVE_WEB_ADDON} ran on webpack: Forgebook draws React Native through react-native-web on Vite`,
          ...read.notes
        ]
      }
    : { options: written, notes: read.notes };
};

/**
 * The packages `reactNativeWeb()` needs beside its own that a project may not have yet.
 *
 * @param options - the adapter's options.
 */
export const reactNativePeers = (
  options: Readonly<Record<string, unknown>> | undefined
): readonly string[] => [
  "react-native-web",
  // Babel runs through Rolldown's plugin, which a catalogue without Babel installs not
  ...(options !== undefined && "babel" in options ? ["@rolldown/plugin-babel", "@babel/core"] : [])
];
