/**
 * Forgebook's adapter for React Native, for the Vite plugin: `defineConfig({ framework: reactNativeWeb() })`.
 *
 * @remarks
 * A React Native component is a React component drawn with React Native's primitives: in the browser, react-native-web
 * draws them with the DOM. So the props are read as React's, and the stories drawn with React's renderer inside a root
 * that lays out as React Native's does (`@forgebook/react-native-web/frame`). What React Native adds is Vite's work:
 * the plugins of `nativePlugin.ts`, the project's PostCSS (`projectPostcss.ts`), and the Babel plugins and presets the
 * catalogue names (Reanimated's, NativeWind's), run by `@rolldown/plugin-babel`. A project's Metro and Babel
 * configuration files are not read: the catalogue names what it needs, as Storybook's React Native Web framework does.
 *
 * @module
 */
import { extname } from "node:path";

import { react } from "@forgebook/react/vite";
import type { FrameworkAdapter } from "forgebook/vite/adapter";
import type { PluginOption } from "vite";

import { babelPlugins } from "./babelPlugins.ts";
import { nativePlugins } from "./nativePlugin.ts";
import { projectPostcss } from "./projectPostcss.ts";

/** A package's name, scoped or not, as npm allows it. */
const PACKAGE_NAME = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/;

/** Which files an option applies to: a path pattern, a regular expression, or a list of them. */
export type FilePattern = string | RegExp | readonly (string | RegExp)[];

/** A Babel plugin or preset, by its module's name, with its options when it takes some: as a Babel configuration writes it. */
export type BabelItem = string | readonly [name: string, options: Readonly<Record<string, unknown>>];

/** The Babel plugins and presets a catalogue runs, as a project's `babel.config.js` names them for Metro. */
export type BabelOptions = {
  /** The plugins (`"react-native-worklets/plugin"` for Reanimated 4, `"react-native-reanimated/plugin"` for 3). */
  readonly plugins?: readonly BabelItem[];
  /**
   * The presets. NativeWind needs none: its JSX runtime (`jsxImportSource`) is enough, and its Babel preset compiles
   * JSX itself and adds Reanimated's plugin a second time.
   */
  readonly presets?: readonly BabelItem[];
};

/** The options of `reactNativeWeb()`: Storybook's React Native Web framework's, under the names Forgebook gives them. */
export type ReactNativeWebOptions = {
  /**
   * The packages written for React Native, by name, besides those of React Native's and Expo's families
   * (`react-native-*`, `@react-native/*`, `expo-*`, `@expo/*`), which always are: a package that imports `react-native`
   * or ships code as Metro reads it (JSX in `.js` files, Flow types). Their code is compiled as Metro compiles it, and
   * their `react-native` is react-native-web on the dev server's Node side too, where the agents' answers read the
   * stories. None by default; Storybook calls them `modulesToTranspile`.
   */
  readonly nativePackages?: readonly string[];
  /**
   * The module JSX is compiled against, for every file the catalogue compiles: `"nativewind"` for NativeWind, whose
   * runtime turns a `className` into styles. React's (`"react"`) by default.
   */
  readonly jsxImportSource?: string;
  /**
   * The Babel plugins and presets run on the files `include` names (the project's own scripts by default), after
   * Vite has resolved them: Reanimated's worklets plugin, NativeWind's preset. They need `@babel/core` and
   * `@rolldown/plugin-babel` installed; without this option, no Babel runs. Storybook's
   * `pluginReactOptions.babel`.
   */
  readonly babel?: BabelOptions;
  /**
   * The files React's plugin (Fast Refresh) and Babel apply to; every script outside `node_modules` by default.
   * Storybook's `pluginReactOptions.include`.
   */
  readonly include?: FilePattern;
  /** The files React's plugin and Babel leave alone; `node_modules` by default. Storybook's `pluginReactOptions.exclude`. */
  readonly exclude?: FilePattern;
};

/**
 * React's Vite plugin (Fast Refresh) on the catalogue's files. The JSX import source is not its: it would reach
 * Forgebook's own pages too, so `nativePlugin.ts` names it in the project's files.
 *
 * @param options - the adapter's options.
 */
const reactPlugin = async (options: ReactNativeWebOptions): Promise<PluginOption> => {
  const { default: plugin } = await import("@vitejs/plugin-react");
  return plugin({
    ...(options.include === undefined ? {} : { include: [options.include].flat() }),
    ...(options.exclude === undefined ? {} : { exclude: [options.exclude].flat() })
  });
};

/**
 * React Native in the browser, through react-native-web, as the plugin reads and draws its components.
 *
 * @param options - the other packages written for React Native, the JSX import source, Babel's plugins and presets.
 * @returns the adapter.
 * @throws when `jsxImportSource` is not a package's name.
 */
export const reactNativeWeb = (options: ReactNativeWebOptions = {}): FrameworkAdapter => {
  // it is written into a comment of every project file and imported by name: a package's name, nothing else
  if (options.jsxImportSource !== undefined && !PACKAGE_NAME.test(options.jsxImportSource))
    throw new Error(
      `reactNativeWeb({ jsxImportSource }) takes a package's name: ${options.jsxImportSource} is not one`
    );
  const base = react();
  return {
    name: "react-native-web",
    // beside this module, with its extension: `.ts` in the sources, `.js` once built for npm
    docsModule: new URL(`./extractDocs${extname(import.meta.url)}`, import.meta.url).href,
    pages: { frame: "@forgebook/react-native-web/frame", code: base.pages.code },
    browserDependencies: [
      ...(base.browserDependencies ?? []),
      "react-native-web",
      ...(options.jsxImportSource === undefined
        ? []
        : [`${options.jsxImportSource}/jsx-runtime`, `${options.jsxImportSource}/jsx-dev-runtime`])
    ],
    vitePlugins: async (): Promise<readonly PluginOption[]> => [
      ...nativePlugins(options),
      projectPostcss(),
      ...(await babelPlugins(options)),
      await reactPlugin(options)
    ]
  };
};
