/**
 * What a React Native project's code needs before the browser can run it: which files are written as React Native
 * writes them (JSX in `.js`, Flow types), the extensions a web build resolves first, the globals React Native's code
 * reads. Pure: the plugin (`nativePlugin.ts`) applies it, the tests read it.
 *
 * @remarks
 * Metro, React Native's bundler, compiles every file with Babel, so React Native code and many of its libraries ship
 * JSX in `.js` files and Flow types: a web bundler reads neither. Those files are compiled here: the project's own
 * `.js` files, and the packages written for React Native: those of React Native's and Expo's families
 * (`react-native-*`, `@react-native/*`, `expo-*`, `@expo/*`) and any the catalogue names. Every other package in
 * `node_modules` is taken as the plain JavaScript its publisher ships, as Vite takes it.
 *
 * @module
 */

import { codeLiteral } from "forgebook/code-literal";

/**
 * The extensions a module is looked for with, the web's first: `Button.web.tsx` wins over `Button.tsx` and over
 * `Button.native.tsx`, which is never read, as Metro does for the web platform.
 */
export const WEB_EXTENSIONS: readonly string[] = [
  ".web.tsx",
  ".web.ts",
  ".web.jsx",
  ".web.js",
  ".web.mjs",
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  ".mjs",
  ".mts",
  ".cjs",
  ".json"
];

/**
 * The packages written for React Native, as a pattern of their names: React Native's family (`react-native-*`,
 * `@react-native/*`) and Expo's (`expo`, `expo-*`, `@expo/*`). `react-native` itself is not among them, since it is
 * never loaded (react-native-web stands for it), nor react-native-web, which ships plain JavaScript.
 */
const NATIVE_FAMILIES = "(?!react-native-web(?:/|$))(?:react-native-|@react-native/|expo(?:-|/|$)|@expo/)";

/**
 * A text matched as it is in a regular expression.
 *
 * @param text - the text.
 */
const escapedPattern = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The packages written for React Native, as a pattern that matches their names and the modules inside them
 * (`@expo/vector-icons/Ionicons`): the families, and the packages the catalogue names.
 *
 * @param nativePackages - the other packages written for React Native, by name.
 */
export const nativePackagePattern = (nativePackages: readonly string[]): RegExp => {
  const named = nativePackages.map((name) => `|${escapedPattern(name)}(?:/|$)`).join("");
  return new RegExp(`^(?:${NATIVE_FAMILIES}${named})`);
};

/** A script React Native writes JSX in: the `.js` and `.mjs` files a web bundler reads as plain JavaScript. */
export const NATIVE_SCRIPT = /\.m?js(?:\?|$)/;

/** The last `node_modules` of a path, and what follows it: the package's name and the file. */
const IN_PACKAGE = /\/node_modules\/((?:@[^/]+\/)?[^/]+)\//g;

/**
 * The package a file belongs to, from its path: the name after its last `node_modules`, so a package pnpm stores in
 * `node_modules/.pnpm/…/node_modules/<name>` is named too.
 *
 * @param file - the file's path, with `/` separators.
 * @returns the package's name, or none for a file of the project's own.
 */
export const packageOf = (file: string): string | undefined => {
  const matches = [...file.split("\\").join("/").matchAll(IN_PACKAGE)];
  return matches.at(-1)?.[1];
};

/**
 * Whether a package is written for React Native: one of React Native's or Expo's families, or one the catalogue names.
 *
 * @param name - the package's name.
 * @param nativePackages - the other packages written for React Native, by name.
 */
export const isNativePackage = (name: string, nativePackages: readonly string[]): boolean =>
  nativePackagePattern(nativePackages).test(name);

/**
 * Whether a file is compiled as React Native's code: one of the project's own (a linked package of a monorepo among
 * them), or one of a package written for React Native.
 *
 * @param file - the file's path, its query left out.
 * @param nativePackages - the other packages written for React Native, by name.
 */
export const isNativeSource = (file: string, nativePackages: readonly string[]): boolean => {
  const name = packageOf(file);
  return name === undefined || isNativePackage(name, nativePackages);
};

/**
 * The globals React Native's code reads, as the web build gives them: Metro defines `__DEV__`, Expo's Babel preset
 * `process.env.EXPO_OS`, and React Native's runtime names the global object `global`.
 *
 * @param isDevelopment - whether the catalogue runs in development (the dev server) or is built.
 * @returns the definitions, each value a JavaScript expression.
 */
export const nativeDefines = (isDevelopment: boolean): Readonly<Record<string, string>> => ({
  // biome-ignore lint/style/useNamingConvention: the global's name, as React Native's code reads it
  __DEV__: codeLiteral(isDevelopment),
  "process.env.EXPO_OS": codeLiteral("web"),
  global: "globalThis"
});

/**
 * The globals React Native's code reads on the dev server's Node side, where the agents' answers load the stories:
 * the browser's, and the animation frames Node has none of. Reanimated asks for a frame as it loads; without one, the
 * request throws outside any story and stops the dev server. A frame there is a timer's turn: nothing is drawn.
 *
 * @param isDevelopment - whether the catalogue runs in development.
 */
export const serverDefines = (isDevelopment: boolean): Readonly<Record<string, string>> => ({
  ...nativeDefines(isDevelopment),
  requestAnimationFrame: "globalThis.setTimeout",
  cancelAnimationFrame: "globalThis.clearTimeout"
});

/** A pragma that marks a file as Flow's: `@flow`, or `@noflow`, which may still hold types. */
const FLOW_PRAGMA = /@(?:no)?flow\b/;

/** `flow-remove-types`, as the plugin calls it: the file's code in, an object whose text is the code without types. */
type FlowRemoveTypes = {
  /** Strips a file's types, keeping every other character where it was. */
  readonly default: (source: string) => { readonly toString: () => string };
};

/** The package that strips Flow types: named by a variable, since it ships no types and is checked once loaded. */
const FLOW_REMOVE_TYPES = "flow-remove-types";

/**
 * Whether a loaded module is `flow-remove-types`: its default export is a function.
 *
 * @param module - the module, as `import()` gave it.
 */
const isFlowRemoveTypes = (module: unknown): module is FlowRemoveTypes =>
  typeof module === "object" &&
  module !== null &&
  "default" in module &&
  typeof module.default === "function";

/**
 * A file's code without its Flow types: blanked out in place, so its lines and columns, and the source map of what
 * compiles it next, stay right. A file without a Flow pragma is returned as it is, and `flow-remove-types` is loaded
 * the first time a file needs it: most projects never do.
 *
 * @param code - the file's code.
 */
export const withoutFlow = async (code: string): Promise<string> => {
  if (!FLOW_PRAGMA.test(code)) return code;
  const loaded: unknown = await import(FLOW_REMOVE_TYPES);
  if (!isFlowRemoveTypes(loaded))
    throw new Error(`${FLOW_REMOVE_TYPES} has no default export to strip Flow types with`);
  return loaded.default(code).toString();
};
