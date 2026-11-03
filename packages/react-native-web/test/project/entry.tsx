/**
 * The small project the plugin's build test compiles: React Native's primitives, a web variant, a `.js` file written
 * as Metro reads it, and an image `require`d.
 *
 * @module
 */
import { Image, Platform, View } from "react-native";

import { Badge } from "./Badge";
import { note } from "./note";

/** What the entry draws: every case at once. */
export const App = (): unknown => (
  <View>
    <Image source={require("./logo.png")} />
    <Badge label={note} />
    {Platform.OS}
  </View>
);
