/**
 * The Babel plugins and presets a React Native catalogue names (Reanimated's worklets plugin, NativeWind's preset), run
 * by `@rolldown/plugin-babel`, loaded only when the catalogue names some.
 *
 * @remarks
 * Metro runs Babel on every file; Vite runs none. Most of what Babel does for React Native, Vite does faster
 * (`nativePlugin.ts`), but a library's own Babel plugin rewrites code no other tool understands: Reanimated's turns a
 * function into a worklet. So the catalogue names the plugins it needs, as Storybook's React Native Web framework asks
 * (`pluginReactOptions.babel`), and they run on the scripts outside `node_modules` by default: the project's, and
Forgebook's own only where they are linked rather than installed (a monorepo that develops Forgebook), where a plugin
meant for the project's code reads them too. `@babel/core` and
 * `@rolldown/plugin-babel` are optional peers: a catalogue without Babel installs neither.
 *
 * @module
 */
import type { PluginOption } from "vite";

import type { BabelItem, ReactNativeWebOptions } from "./reactNativeWeb.ts";

/**
 * A plugin or preset as Babel takes it: its name, or its name and options.
 *
 * @param item - the item.
 */
const babelItem = (item: BabelItem): string | [string, Readonly<Record<string, unknown>>] =>
  typeof item === "string" ? item : [item[0], item[1]];

/**
 * The Babel plugin of a catalogue's options: none without `babel`.
 *
 * @param options - the adapter's options.
 * @throws when `babel` names plugins but `@rolldown/plugin-babel` is not installed, saying what to install.
 */
export const babelPlugins = async (options: ReactNativeWebOptions): Promise<PluginOption[]> => {
  const { babel } = options;
  const plugins = (babel?.plugins ?? []).map(babelItem);
  const presets = (babel?.presets ?? []).map(babelItem);
  if (plugins.length === 0 && presets.length === 0) return [];
  let load: typeof import("@rolldown/plugin-babel");
  try {
    load = await import("@rolldown/plugin-babel");
  } catch {
    throw new Error(
      "reactNativeWeb({ babel }) runs Babel through @rolldown/plugin-babel: install it with @babel/core " +
        "(npm install --save-dev @rolldown/plugin-babel @babel/core)"
    );
  }
  return [
    await load.default({
      plugins,
      presets,
      ...(options.include === undefined ? {} : { include: [options.include].flat() }),
      ...(options.exclude === undefined ? {} : { exclude: [options.exclude].flat() })
    })
  ];
};
