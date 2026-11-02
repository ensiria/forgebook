/**
 * The Forgebook framework a project's Storybook moves to: React's for `@storybook/react-vite`, React Native's (through
 * react-native-web) for `@storybook/react-native-web-vite`, for Storybook's older React Native Web addon and for
 * on-device Storybook (`@storybook/react-native`), with what each says that Forgebook reads.
 *
 * @remarks
 * Pure: `main`'s configuration in, the framework and the notes out; `storybook.ts` loads `main` and calls it. The
 * React Native frameworks give the packages they compile (`modulesToTranspile`) to `reactNativeWeb({ nativePackages })`;
 * their `pluginReactOptions` (the JSX import source, Babel's plugins and presets, the files) become the adapter's
 * options of the same meaning; what cannot be written as a plain value (a function, a regular expression) is named
 * in a note.
 *
 * @module
 */
import { VITE_PATHS } from "../../../src/vite/vitePaths.ts";

/** A Forgebook framework, as the written configuration names it. */
export type ImportedFramework = {
  /** The package whose `./vite` export has the adapter (`@forgebook/react`). */
  readonly packageName: string;
  /** The adapter's function, called in the configuration (`react`). */
  readonly adapter: string;
  /** The adapter's options, plain values written into the configuration; none when there are none. */
  readonly options?: Readonly<Record<string, unknown>>;
  /** The packages it needs beside its own that a project may not have yet (`react-native-web`); none by default. */
  readonly peers?: readonly string[];
};

/** The framework and what was not read. */
export type FrameworkReading = {
  /** The Forgebook framework. */
  readonly framework: ImportedFramework;
  /** What Forgebook does not read of the Storybook framework, each a sentence. */
  readonly notes: readonly string[];
};

/** Storybook's React framework on Vite. */
const REACT_VITE = "@storybook/react-vite";

/** Storybook's React Native framework for the browser, on Vite. */
const REACT_NATIVE_WEB_VITE = "@storybook/react-native-web-vite";

/** Storybook's older React Native Web addon, on webpack, beside a React framework. */
const REACT_NATIVE_WEB_ADDON = "@storybook/addon-react-native-web";

/** The Storybook frameworks Forgebook reads, as a refusal names them. */
export const STORYBOOK_FRAMEWORKS: readonly string[] = [
  REACT_VITE,
  REACT_NATIVE_WEB_VITE,
  "on-device @storybook/react-native"
];

/** React, as Forgebook's configuration names it. */
const REACT: ImportedFramework = { packageName: "@forgebook/react", adapter: "react" };

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Whether a package name or a path to it names a package: Storybook's monorepo template writes the path
 * (`getAbsolutePath("@storybook/react-vite")`).
 *
 * @param written - the name or the path.
 * @param name - the package.
 */
const names = (written: string, name: string): boolean => {
  const path = VITE_PATHS.normalize(written).replace(/\/$/, "");
  return path === name || path.endsWith(`/${name}`);
};

/**
 * A framework or an addon as `main` writes it: a text, or an object with its `name` and its `options`.
 *
 * @param entry - the entry.
 */
const entryOf = (
  entry: unknown
): { readonly name: string | undefined; readonly options: Readonly<Record<string, unknown>> } => {
  if (typeof entry === "string") return { name: entry, options: {} };
  if (!isRecord(entry)) return { name: undefined, options: {} };
  return {
    name: typeof entry["name"] === "string" ? entry["name"] : undefined,
    options: isRecord(entry["options"]) ? entry["options"] : {}
  };
};

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
export const reactNativeWebOptions = (options: Readonly<Record<string, unknown>>): ReadOptions => {
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
 * React Native through react-native-web, with a Storybook framework's options.
 *
 * @param read - the options read.
 */
const reactNativeWeb = (read: ReadOptions): ImportedFramework => ({
  packageName: "@forgebook/react-native-web",
  adapter: "reactNativeWeb",
  peers: [
    "react-native-web",
    // Babel runs through Rolldown's plugin, which a catalogue without Babel installs not
    ...("babel" in read.options ? ["@rolldown/plugin-babel", "@babel/core"] : [])
  ],
  ...(Object.keys(read.options).length === 0 ? {} : { options: read.options })
});

/**
 * The Forgebook framework of a project's Storybook.
 *
 * @param main - `main`'s configuration.
 * @param isOnDevice - whether `main` is on-device Storybook's (`.rnstorybook`, or a project on
 *   `@storybook/react-native`), which names no framework or names that package.
 * @returns the framework and the notes, or none for a framework Forgebook does not read.
 */
export const storybookFramework = (
  main: Readonly<Record<string, unknown>>,
  isOnDevice: boolean
): FrameworkReading | undefined => {
  const framework = entryOf(main["framework"]);
  const addons = Array.isArray(main["addons"]) ? main["addons"].map(entryOf) : [];
  if (framework.name !== undefined && names(framework.name, REACT_NATIVE_WEB_VITE)) {
    const read = reactNativeWebOptions(framework.options);
    return { framework: reactNativeWeb(read), notes: read.notes };
  }
  const addon = addons.find((each) => each.name !== undefined && names(each.name, REACT_NATIVE_WEB_ADDON));
  if (addon !== undefined) {
    const read = reactNativeWebOptions(addon.options);
    return {
      framework: reactNativeWeb(read),
      notes: [
        `${REACT_NATIVE_WEB_ADDON} ran on webpack: Forgebook draws React Native through react-native-web on Vite`,
        ...read.notes
      ]
    };
  }
  const isOnDeviceFramework =
    framework.name !== undefined && names(framework.name, "@storybook/react-native");
  if (isOnDeviceFramework || (framework.name === undefined && isOnDevice)) {
    return {
      framework: reactNativeWeb({ options: {}, notes: [] }),
      notes: [
        "On-device Storybook: the stories are drawn in the browser through react-native-web, so a component that needs a native module does not draw",
        ...(main["deviceAddons"] === undefined
          ? []
          : ["The device addons are left out: Forgebook has its own panel"])
      ]
    };
  }
  return framework.name !== undefined && names(framework.name, REACT_VITE)
    ? { framework: REACT, notes: [] }
    : undefined;
};
