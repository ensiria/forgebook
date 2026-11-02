/**
 * Forgebook's adapter for React Native, for the Vite plugin: `defineConfig({ framework: reactNativeWeb() })`.
 *
 * @remarks
 * A React Native component is a React component drawn with React Native's primitives: in the browser, react-native-web
 * draws them with the DOM. So the props are read as React's, and the stories drawn with React's renderer inside a root
 * that lays out as React Native's does (`@forgebook/react-native-web/frame`). What React Native adds is Vite's work,
 * the plugins of `nativePlugin.ts`. Forgebook stays on Vite: a project's Metro and Babel configurations are not read.
 *
 * @module
 */
import { extname } from "node:path";

import { react } from "@forgebook/react/vite";
import type { FrameworkAdapter } from "forgebook/vite/adapter";
import type { PluginOption } from "vite";

import { nativePlugins } from "./nativePlugin.ts";

/** The options of `reactNativeWeb()`. */
export type ReactNativeWebOptions = {
  /**
   * The packages written for React Native, by name, besides those of React Native's and Expo's families
   * (`react-native-*`, `@react-native/*`, `expo-*`, `@expo/*`), which always are: a package that imports `react-native`
   * or ships code as Metro reads it (JSX in `.js` files, Flow types). Their code is compiled as Metro compiles it, and
   * their `react-native` is react-native-web on the dev server's Node side too, where the agents' answers read the
   * stories. None by default.
   */
  readonly nativePackages?: readonly string[];
};

/**
 * React Native in the browser, through react-native-web, as the plugin reads and draws its components.
 *
 * @param options - the other packages written for React Native.
 * @returns the adapter.
 */
export const reactNativeWeb = (options: ReactNativeWebOptions = {}): FrameworkAdapter => {
  const base = react();
  return {
    name: "react-native-web",
    // beside this module, with its extension: `.ts` in the sources, `.js` once built for npm
    docsModule: new URL(`./extractDocs${extname(import.meta.url)}`, import.meta.url).href,
    pages: { frame: "@forgebook/react-native-web/frame", code: base.pages.code },
    browserDependencies: [...(base.browserDependencies ?? []), "react-native-web"],
    vitePlugins: async (): Promise<readonly PluginOption[]> => [
      ...nativePlugins(options),
      ...((await base.vitePlugins?.()) ?? [])
    ]
  };
};
