/**
 * The wind's speed in a badge: JSX in a `.js` file, as React Native projects write it and Metro reads it.
 *
 * @module
 */
import { StyleSheet, Text, View } from "react-native";

import { speedText } from "./knots";

/**
 * The wind's badge.
 *
 * @param {{ knots: number, unit?: "kn" | "km/h" }} props - the speed in knots, and the unit it is written in.
 */
export const WindBadge = ({ knots, unit = "kn" }) => (
  <View style={styles.badge}>
    <Text testID="wind-speed" style={styles.text}>
      Wind {speedText(knots, unit)}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#fff3d6"
  },
  text: { color: "#7a4b00", fontWeight: "600" }
});
