/**
 * The Vite plugins that let a React Native project's components run in the browser: `react-native` resolved to
 * `react-native-web`, the web's files first, React Native's globals, JSX in `.js` files and Flow types compiled, and
 * `require` of an image or a font made its address.
 *
 * @remarks
 * Metro, React Native's bundler, does all of it for a phone; here Vite does it for the catalogue's frames. Three
 * places read the project's code, and each compiles the same files (`isNativeSource`), so what draws on the dev
 * server draws in a built catalogue and reads the same on the Node side:
 *
 * - the dev server's dependency pre-bundling (Rolldown, given a plugin of its own here);
 * - Vite's own pipeline: the project's files on the dev server, everything in a build;
 * - the dev server's Node side, where the agents' answers load the stories. Node itself would load a package Vite
 *   leaves external, with the real `react-native` (Flow, native modules), so the packages written for React Native go
 *   through Vite there too, pre-bundled as in the browser: they mix CommonJS files into ES modules, which only a bundle
 *   runs on that side.
 *
 * A deep import of React Native's own files (`react-native/Libraries/…`) has no web version: it fails with a message
 * naming the module, instead of a Flow syntax error deep inside React Native.
 *
 * @module
 */
import {
  type ConfigEnv,
  type DepOptimizationConfig,
  type DepOptimizationOptions,
  type Plugin,
  parseAst,
  type Rolldown,
  transformWithOxc,
  type UserConfig
} from "vite";

import { importedAssets } from "./assetRequires.ts";
import { isForgebookFile } from "./forgebookFiles.ts";
import {
  isNativeSource,
  NATIVE_SCRIPT,
  nativeDefines,
  nativePackagePattern,
  serverDefines,
  WEB_EXTENSIONS,
  withoutFlow
} from "./nativeSources.ts";
import type { ReactNativeWebOptions } from "./reactNativeWeb.ts";

/** React Native's own files, imported by path: Metro's internals, which have no web version. */
const DEEP_NATIVE_IMPORT = /^react-native\/(.+)$/;

/** A script that may hold JSX besides `.js`: the JSX import source is named in it. */
const JSX_SCRIPT = /\.[jt]sx(?:\?|$)/;

/** A pragma that names a file's JSX import source already. */
const JSX_PRAGMA = /@jsxImportSource\s/;

/** The scripts a `require` of an asset is looked for in: every kind Vite compiles. */
const SCRIPT_FILE = /\.(?:[cm]?[jt]sx?)(?:\?|$)/;

/**
 * A module's path without its query (`?v=…`, `?import`).
 *
 * @param id - the module's id.
 */
const withoutQuery = (id: string): string => id.split("?", 1)[0] ?? id;

/**
 * The plugin the dependency pre-bundling runs: the dependencies written for React Native compiled as Metro compiles
 * them, their `.js` files read as JSX once their Flow types are gone, and their `require` of an asset made its
 * address, as in a build (the pre-bundling would make it a module object, which `Image` cannot draw).
 *
 * @param nativePackages - the other packages written for React Native, by name.
 */
export const prebundlePlugin = (nativePackages: readonly string[]): Rolldown.Plugin => ({
  name: "forgebook:react-native-web-prebundle",
  transform: {
    filter: { id: NATIVE_SCRIPT },
    handler: async (code: string, id: string): Promise<Rolldown.TransformResult> => {
      if (!isNativeSource(withoutQuery(id), nativePackages)) return null;
      const plain = await withoutFlow(code);
      const withAssets = plain.includes("require")
        ? importedAssets(plain, parseAst(plain, { lang: "jsx" }))
        : undefined;
      return { code: withAssets ?? plain, moduleType: "jsx" };
    }
  }
});

/**
 * The packages written for React Native that a catalogue names, with its JSX import source's: NativeWind's runtime
 * imports `react-native` as the other packages do.
 *
 * @param options - the adapter's options.
 */
const nativePackagesOf = (options: ReactNativeWebOptions): readonly string[] => [
  ...(options.nativePackages ?? []),
  ...(options.jsxImportSource === undefined || options.jsxImportSource === "react"
    ? []
    : [options.jsxImportSource])
];

/**
 * How JSX is compiled: React's automatic runtime, from the catalogue's import source (NativeWind's) when it names one.
 *
 * @param options - the adapter's options.
 */
const jsxOptions = (options: ReactNativeWebOptions): { runtime: "automatic"; importSource?: string } => ({
  runtime: "automatic",
  ...(options.jsxImportSource === undefined ? {} : { importSource: options.jsxImportSource })
});

/**
 * What the plugin adds to Vite's configuration.
 *
 * @param isDevelopment - whether the catalogue runs on the dev server.
 * @param options - the adapter's options: the other packages written for React Native, the JSX import source.
 * @param entries - the files the dev server scans for the dependencies to pre-bundle (the story files, as Forgebook's
 *   plugin names them for the browser), scanned on the Node side too.
 */
export const nativeConfig = (
  isDevelopment: boolean,
  options: ReactNativeWebOptions,
  entries: DepOptimizationOptions["entries"]
): UserConfig => {
  const nativePackages = nativePackagesOf(options);
  const define = nativeDefines(isDevelopment);
  /**
   * The pre-bundling's options, with the globals it defines.
   *
   * @param defines - the globals.
   */
  const prebundling = (defines: Readonly<Record<string, string>>): DepOptimizationConfig => ({
    rolldownOptions: {
      // Expo's packages are compiled from TypeScript one file at a time, so an import of a type is left as an import
      // of a module that exports nothing (`expo-modules-core`'s declarations): Metro lets it be `undefined`, as here
      shimMissingExports: true,
      resolve: { extensions: [...WEB_EXTENSIONS] },
      transform: { define: { ...defines }, jsx: jsxOptions(options) },
      plugins: [prebundlePlugin(nativePackages)]
    }
  });
  return {
    resolve: {
      // exactly `react-native`: `react-native-web`, `react-native-svg` and the others keep their own name
      alias: [{ find: /^react-native$/, replacement: "react-native-web" }],
      extensions: [...WEB_EXTENSIONS]
    },
    define,
    build: { rolldownOptions: { shimMissingExports: true } },
    optimizeDeps: { ...prebundling(define), include: ["react-native-web"] },
    environments: {
      ssr: {
        resolve: { noExternal: [nativePackagePattern(nativePackages), "react-native-web"] },
        // scanned up front as the browser's are, so no answer meets a dependency the bundle lacks and fails while the
        // bundle is made again
        optimizeDeps: {
          ...prebundling(serverDefines(isDevelopment)),
          noDiscovery: false,
          include: ["react-native-web"],
          ...(entries === undefined ? {} : { entries })
        }
      }
    }
  };
};

/**
 * The plugins.
 *
 * @param options - the packages written for React Native beyond React Native's and Expo's families.
 * @returns the plugin that sets Vite up and compiles React Native's code, and the one that writes `require` of an
 * asset as its import (after Vite's own compiling, on plain JavaScript).
 */
export const nativePlugins = (options: ReactNativeWebOptions): Plugin[] => {
  const nativePackages = nativePackagesOf(options);
  // the project's own files and the packages written for React Native, never Forgebook's own modules
  const isProjectSource = (id: string): boolean => {
    const file = withoutQuery(id);
    return isNativeSource(file, nativePackages) && !isForgebookFile(file);
  };
  const { jsxImportSource } = options;
  let isDevelopment = true;
  return [
    {
      name: "forgebook:react-native-web",
      enforce: "pre",
      config: (config: UserConfig, environment: ConfigEnv): UserConfig => {
        isDevelopment = environment.command === "serve";
        return nativeConfig(isDevelopment, options, config.optimizeDeps?.entries);
      },
      resolveId: {
        filter: { id: DEEP_NATIVE_IMPORT },
        handler(source: string, importer: string | undefined): null {
          const from = importer === undefined ? "" : ` (imported by ${withoutQuery(importer)})`;
          this.error(
            `${source}${from} is one of React Native's own files, which have no web version: ` +
              "only `react-native` itself runs in the browser, as react-native-web"
          );
        }
      },
      // React Native writes JSX in `.js` files, which Vite reads as plain JavaScript: compiled before Vite reads them
      transform: {
        filter: { id: NATIVE_SCRIPT },
        handler: async (code: string, id: string): Promise<Rolldown.TransformResult> => {
          const file = withoutQuery(id);
          if (!isProjectSource(file)) return null;
          const compiled = await transformWithOxc(await withoutFlow(code), file, {
            lang: "jsx",
            jsx: { ...jsxOptions(options), development: isDevelopment },
            sourcemap: true
          });
          return { code: compiled.code, map: compiled.map ?? null };
        }
      }
    },
    {
      // the JSX import source (NativeWind's) is the project's, not Forgebook's own pages': named in each of its files,
      // on their first line so the others keep their place
      name: "forgebook:react-native-web-jsx-source",
      enforce: "pre",
      transform: {
        filter: { id: JSX_SCRIPT },
        handler: (code: string, id: string): Rolldown.TransformResult => {
          if (jsxImportSource === undefined || JSX_PRAGMA.test(code) || !isProjectSource(id)) return null;
          return { code: `/** @jsxImportSource ${jsxImportSource} */ ${code}`, map: null };
        }
      }
    },
    {
      name: "forgebook:react-native-web-assets",
      transform: {
        filter: { id: SCRIPT_FILE, code: "require" },
        handler(code: string, id: string): Rolldown.TransformResult {
          if (!isProjectSource(id)) return null;
          const rewritten = importedAssets(code, this.parse(code));
          // the module keeps its lines and columns, so its source map stays as it is
          return rewritten === undefined ? null : { code: rewritten, map: null };
        }
      }
    }
  ];
};
