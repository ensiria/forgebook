/**
 * The next high tide's time, in JetBrains Mono: the font is loaded with Expo's `useFonts`, its file `require`d as
 * React Native names a font, and the time waits for it, as an app's splash screen does.
 *
 * @module
 */
import { useFonts } from "expo-font";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

/** The font's family, as the stories and the tests name it. */
export const TIDE_FONT = "JetBrainsMono";

/** The tide's props. */
export type TideTimeProps = {
  /** The time, as the harbour's board writes it (`14:32`). */
  readonly time: string;
  /** The tide's height above chart datum, in metres. */
  readonly height: number;
};

/**
 * The next high tide.
 *
 * @param props - the tide's props.
 */
export const TideTime = ({ time, height }: TideTimeProps): ReactNode => {
  const [isLoaded] = useFonts({ [TIDE_FONT]: require("./fonts/JetBrainsMono-latin.woff2") });
  if (!isLoaded) return <Text style={styles.label}>Loading…</Text>;
  return (
    <View style={styles.board}>
      <Text style={styles.label}>Next high tide</Text>
      <Text testID="tide-time" style={styles.time}>
        {time}
      </Text>
      <Text style={styles.label}>{height.toFixed(1)} m</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  board: { alignItems: "flex-start", gap: 4, padding: 16, borderRadius: 12, backgroundColor: "#10212c" },
  label: { color: "#b9cad6", fontSize: 13 },
  time: { color: "#ffffff", fontSize: 40, fontFamily: TIDE_FONT }
});
