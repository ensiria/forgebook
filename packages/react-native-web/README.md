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
`@storybook/react-native-web-vite` (its `modulesToTranspile` become `nativePackages`), the older
`@storybook/addon-react-native-web`, and on-device Storybook's `.rnstorybook` folder.

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

```ts
reactNativeWeb({ nativePackages: ["legacy-chart"] });
```

`nativePackages` names a package outside those families that imports `react-native` or ships JSX in `.js` or Flow.

## What does not work in a browser

react-native-web draws React Native's components with the DOM; what needs the phone itself does not draw:

- **Native modules.** A component that calls a module of native code (the camera, Bluetooth, a native SDK) through
  `NativeModules`, TurboModules or Expo's `requireNativeModule` throws or gets nothing. Give it a `.web.tsx` file, or
  stand in for the module in the preview.
- **Gestures and animations of native code.** `react-native-gesture-handler`'s and Reanimated's worklets run on the
  UI thread of a phone; Forgebook runs no Babel, so Reanimated's Babel plugin does not run either. Their web support
  is theirs and is not tested here.
- **React Native's own files** (`react-native/Libraries/…`): they have no web version, and an import of one fails with
  a message naming it.
- **A project's Babel and Metro configurations** are not read: NativeWind's `jsxImportSource`, a Babel plugin, Metro's
  resolver options.
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
