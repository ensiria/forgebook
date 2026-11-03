# @forgebook/react-native-web

React Native for [Forgebook](https://www.npmjs.com/package/forgebook): a React Native project's components drawn in the
browser through [react-native-web](https://necolas.github.io/react-native-web/), on Vite, their props read from their
TypeScript types as React's are.

**Requirements:** React 18.2 or 19 · `react-native` 0.76 or later (its types; 0.88 is the one tested) ·
`react-native-web` 0.21 · `forgebook` · Vite 8 · [MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/react-native-web/LICENSE)

```sh
npm install --save-dev forgebook @forgebook/react-native-web react-native-web
```

`react-native` and `react-native-web` are peers: the project's own versions are the ones drawn.

## A first catalogue

```ts
// forgebook.config.ts
import { reactNativeWeb } from "@forgebook/react-native-web/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: reactNativeWeb(),
  title: "My app",
  stories: ["src/**/*.stories.tsx"]
});
```

A story file is a React story file; the types come from this package:

```tsx
import type { Meta, Story } from "@forgebook/react-native-web";

import { ProfileCard } from "./ProfileCard";

export default { title: "Crew/Profile card", component: ProfileCard } satisfies Meta<typeof ProfileCard>;

/** A member online. */
export const Online: Story<typeof ProfileCard> = { args: { name: "Ada", role: "First mate", isOnline: true } };
```

The app's root providers go in the preview, around every story:

```tsx
// forgebook.preview.tsx
import type { Preview } from "@forgebook/react-native-web";
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";

export default {
  decorators: [
    (Story) => (
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <Story />
      </SafeAreaProvider>
    )
  ]
} satisfies Preview;
```

A project on Storybook writes this configuration with `npx forgebook init --from storybook`: it reads
`@storybook/react-native-web-vite` (its `modulesToTranspile` and `pluginReactOptions` become the options below), the
older `@storybook/addon-react-native-web`, and on-device Storybook (`.rnstorybook`, or `.storybook` in a project on
`@storybook/react-native`).

## What it does

What Metro does for a phone, Vite does for the catalogue:

| | |
|---|---|
| `react-native` | resolved to `react-native-web`, exactly: `react-native-svg` and the others keep their name |
| `.web.tsx`, `.web.ts`, `.web.jsx`, `.web.js`, `.web.mjs` | read before the plain file, as Metro does for the web; `.native` and `.ios` files are never read |
| JSX in `.js` files, Flow types | compiled in the project's own files and in the packages written for React Native (`react-native-*`, `@react-native/*`, `expo`, `expo-*`, `@expo/*`, and those named in `nativePackages`), on the dev server and in a build |
| `require("./logo.png")`, `require("./Font.ttf")` | the asset's address, which `Image` and Expo's `useFonts` take, in an ES module (a file that imports or exports; a CommonJS file keeps its `require`); the file is copied into a built catalogue |
| `__DEV__`, `process.env.EXPO_OS`, `global` | defined as Metro and Expo's Babel preset define them |
| `Platform.OS` | `"web"`, from react-native-web; `Platform.select` picks `web` |
| A screen's `flex: 1` | each story is drawn in a root laid out as React Native's root view (a flex column): with `parameters.layout: "fullscreen"`, a screen fills the frame |
| Props | read from the component's TypeScript types as React's: its own props, not those it takes from React Native (`ViewProps`, `PressableProps`) |
| Agents | `forgebook story`, `forgebook mcp` and the other commands read React Native stories as React's: the packages written for React Native are pre-bundled on the dev server's Node side too, where Node would otherwise load the real `react-native` |

Fonts and icons work as in an Expo web app: `useFonts` and `@expo/vector-icons` load their font files through
`expo-font`, which runs in the browser.

## Options

`reactNativeWeb()` takes Storybook's React Native Web options, under these names:

| Option | Storybook's | What it does |
|---|---|---|
| `nativePackages` | `modulesToTranspile` | Packages outside the families above that import `react-native` or ship JSX in `.js` or Flow |
| `jsxImportSource` | `pluginReactOptions.jsxImportSource` | The JSX runtime of the project's files: `"nativewind"` for NativeWind. Forgebook's own pages keep React's |
| `babel` | `pluginReactOptions.babel` | `{ plugins, presets }`, by module name (and options): run on the project's files, as Metro runs them. Needs `@rolldown/plugin-babel` and `@babel/core` |
| `include`, `exclude` | `pluginReactOptions.include`, `.exclude` | The files React's plugin (Fast Refresh) and Babel apply to; the project's scripts outside `node_modules` by default |

A project's `postcss.config` is run on its style sheets, as Expo does on the web (Forgebook otherwise compiles CSS
with Lightning CSS alone); `postcss` is then the project's to install, and `jiti` or `tsx` too for a
`postcss.config.ts`.

### Reanimated

```sh
npm install --save-dev @rolldown/plugin-babel @babel/core
```

```ts
reactNativeWeb({ babel: { plugins: ["react-native-worklets/plugin"] } }); // Reanimated 4; 3 names "react-native-reanimated/plugin"
```

The plugin compiles the project's worklets (`useAnimatedStyle`, `useDerivedValue`…), and Reanimated runs them in the
browser, as its web support does. On the dev server's Node side, where the agents read the stories, Reanimated gets
an animation frame from a timer, since Node draws none.

### NativeWind

NativeWind 4 on Tailwind 3, as its web setup asks: a `tailwind.config.js` with its preset, a `postcss.config.js`
naming `tailwindcss`, a style sheet with Tailwind's directives imported by the preview, and its JSX runtime:

```ts
reactNativeWeb({ jsxImportSource: "nativewind" });
```

NativeWind's Babel preset (`nativewind/babel`), which Metro needs, is not needed here and is best left out: it
compiles JSX itself, for Forgebook's own linked files too, and adds Reanimated's plugin a second time.

```tsx
// forgebook.preview.tsx
import "./global.css";
```

`dark:` classes follow the catalogue's theme when Tailwind's `darkMode` is `"class"` and the theme switch sets a
class on the frame: `switches: [{ ...themeSwitch(), apply: { kind: "class", prefix: "" } }]` (`themeSwitch` from
`forgebook/switches`). With `darkMode: "media"`, NativeWind refuses the theme switch's changes.

### A native module in a story

Native code cannot run in a browser, so a story stands in for the module its component calls, as Storybook advises
for its on-device version. react-native-web's `NativeModules` is a plain object: a story's `beforeEach` puts the
stand-in there and returns what takes it away.

```tsx
import { NativeModules } from "react-native";

export const Charged: Story<typeof BatteryBadge> = {
  beforeEach: () => {
    NativeModules["HarbourBattery"] = { getLevel: async () => 0.82 };
    return () => {
      Reflect.deleteProperty(NativeModules, "HarbourBattery");
    };
  }
};
```

For every story, the same goes in the preview's `beforeEach`. An Expo module of the app's own
(`requireNativeModule("HarbourBattery")`) throws on the web unless the module has a web file, as Expo's modules
do: `HarbourBatteryModule.web.ts`, exporting `registerWebModule(...)` of a class that answers in the browser, which
the catalogue reads before the native file. On the dev server's Node side, where the agents read the stories,
Expo's `requireNativeModule` gives an empty object rather than throwing, so a missing stand-in fails there at the
first call. A component whose web version differs more than a stand-in can cover
gets a `.web.tsx` file the same way.

## What does not work in a browser

react-native-web draws React Native's components with the DOM; what needs the phone itself does not draw:

- **Native modules.** A component that calls a module of native code (the camera, Bluetooth, a native SDK) through
  `NativeModules`, TurboModules or Expo's `requireNativeModule` throws or gets nothing: native code cannot run in a
  browser. Stand in for the module in its stories (above), or give the component a `.web.tsx` file.
- **What needs the phone's UI thread.** Reanimated's animations run, as its web support runs them, on the page's
  thread; what has no web version (`react-native-gesture-handler`'s native gestures, a worklet run on another thread
  with `runOnRuntime`) does not.
- **React Native's own files** (`react-native/Libraries/…`): they have no web version, and an import of one fails with
  a message naming it.
- **A project's `babel.config.js` and `metro.config.js`** are not read: the catalogue names its Babel plugins and JSX
  source (above); Metro's resolver options have no counterpart. `jsxRuntime: "classic"` is not offered.
- **What react-native-web leaves out**: the older `accessibilityState` is not drawn (write `aria-checked`,
  `aria-disabled`… as React Native 0.71 and later accept), and the components and APIs its
  [compatibility table](https://necolas.github.io/react-native-web/docs/react-native-compatibility/) marks as missing.
- **Safe areas** are zero in a browser window: a story that reads them gets what its `SafeAreaProvider`'s
  `initialMetrics` say.
- **Expo's packages** compiled from TypeScript file by file import types as modules: those imports are let be
  `undefined`, as Metro does, and a build names each (`SHIMMED_EXPORT`). This holds for the whole catalogue: an
  export missing anywhere is `undefined` with that warning, not a failed build.

| Import | What it is |
|---|---|
| `@forgebook/react-native-web` | `Meta`, `Story`, `Decorator`, `Preview`, `LogicMeta`, `LogicStory`: React's story types |
| `@forgebook/react-native-web/vite` | `reactNativeWeb()`, the framework adapter of `forgebook.config.ts` |

The rest of its exports are what the catalogue loads itself. Getting started, the catalogue's features and its
commands: [Forgebook's README](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/README.md).
