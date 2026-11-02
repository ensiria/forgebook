/**
 * The Forgebook framework a project's Storybook moves to: React's for `@storybook/react-vite`, React Native's (through
 * react-native-web) for `@storybook/react-native-web-vite`, for Storybook's older React Native Web addon and for
 * on-device Storybook (`@storybook/react-native`), with what each says that Forgebook reads.
 *
 * @remarks
 * Pure: `main`'s configuration in, the framework and the notes out; `storybook.ts` loads `main` and calls it. The
 * React Native frameworks give the packages they compile (`modulesToTranspile`) to `reactNativeWeb({ nativePackages })`;
 * their Babel options are not read, since Forgebook compiles with Vite and runs no Babel, so each is named in a note.
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

/**
 * React Native through react-native-web, with the packages a Storybook framework compiled.
 *
 * @param modulesToTranspile - the framework's `modulesToTranspile`, as written.
 */
const reactNativeWeb = (modulesToTranspile: unknown): ImportedFramework => {
  const nativePackages = Array.isArray(modulesToTranspile)
    ? modulesToTranspile.filter((name) => typeof name === "string")
    : [];
  return {
    packageName: "@forgebook/react-native-web",
    adapter: "reactNativeWeb",
    peers: ["react-native-web"],
    ...(nativePackages.length === 0 ? {} : { options: { nativePackages } })
  };
};

/**
 * The notes on the Babel options a React Native framework or addon had.
 *
 * @param options - its options.
 * @param fields - the fields that hold Babel's options.
 */
const babelNotes = (options: Readonly<Record<string, unknown>>, fields: readonly string[]): string[] =>
  fields
    .filter((field) => options[field] !== undefined)
    .map(
      (field) =>
        `Its ${field} are not read: Forgebook compiles with Vite and runs no Babel, so a Babel plugin (Reanimated's, NativeWind's) does not run`
    );

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
    return {
      framework: reactNativeWeb(framework.options["modulesToTranspile"]),
      notes: babelNotes(framework.options, ["pluginReactOptions", "pluginBabelOptions"])
    };
  }
  const addon = addons.find((each) => each.name !== undefined && names(each.name, REACT_NATIVE_WEB_ADDON));
  if (addon !== undefined) {
    return {
      framework: reactNativeWeb(addon.options["modulesToTranspile"]),
      notes: [
        `${REACT_NATIVE_WEB_ADDON} ran on webpack: Forgebook draws React Native through react-native-web on Vite`,
        ...babelNotes(addon.options, ["babelPlugins"])
      ]
    };
  }
  const isOnDeviceFramework =
    framework.name !== undefined && names(framework.name, "@storybook/react-native");
  if (isOnDeviceFramework || (framework.name === undefined && isOnDevice)) {
    return {
      framework: reactNativeWeb(undefined),
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
