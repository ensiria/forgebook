/**
 * The React Native fixture's catalogue: a small app's components drawn in the browser through react-native-web, as
 * a React Native project's catalogue is.
 *
 * @module
 */
import { reactNativeWeb } from "@forgebook/react-native-web/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: reactNativeWeb(),
  title: "Harbour crew",
  stories: ["src/**/*.stories.tsx"]
});
