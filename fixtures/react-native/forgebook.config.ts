/**
 * The React Native fixture's catalogue: a small app's components drawn in the browser through react-native-web, as
 * a React Native project's catalogue is, with NativeWind's classes and Reanimated's worklets as the app compiles them.
 *
 * @module
 */
import { reactNativeWeb } from "@forgebook/react-native-web/vite";
import { defineConfig } from "forgebook";
import { themeSwitch } from "forgebook/switches";

export default defineConfig({
  framework: reactNativeWeb({
    jsxImportSource: "nativewind",
    babel: { plugins: ["react-native-worklets/plugin"] }
  }),
  title: "Harbour crew",
  stories: ["src/**/*.stories.tsx"],
  // the theme as a class on the frame's root (`dark`), which NativeWind's `dark:` classes follow
  switches: [{ ...themeSwitch(), apply: { kind: "class", prefix: "" } }]
});
