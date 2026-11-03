/**
 * The React Native package's tests: the renderer in a simulated page, `react-native` resolved to react-native-web as
 * a catalogue resolves it; the plugins' logic on its own.
 *
 * @module
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: [{ find: /^react-native$/, replacement: "react-native-web" }] },
  test: { environment: "happy-dom" }
});
