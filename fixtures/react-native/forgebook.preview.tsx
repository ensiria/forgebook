/**
 * The catalogue's preview: the providers the app puts at its root, around every story. Safe areas come from
 * `react-native-safe-area-context`, with no inset in a frame, as the app has none in a browser window.
 *
 * @module
 */
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
