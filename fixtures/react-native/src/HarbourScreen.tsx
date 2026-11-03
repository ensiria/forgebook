/**
 * A whole screen of the app: a header, a scrolling body and a tab bar, inside the safe areas and filling the window
 * with `flex: 1`, as a screen does on a phone.
 *
 * @module
 */
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WindBadge } from "./legacy/WindBadge";
import { type Task, TaskList } from "./TaskList";
import { TideTime } from "./TideTime";

/** The screen's props. */
export type HarbourScreenProps = {
  /** The harbour's name, in the header. */
  readonly harbour: string;
  /** The wind's speed, in knots. */
  readonly knots: number;
  /** The day's tasks. */
  readonly tasks: readonly Task[];
};

/**
 * The harbour's screen.
 *
 * @param props - the screen's props.
 */
export const HarbourScreen = ({ harbour, knots, tasks }: HarbourScreenProps): ReactNode => (
  <SafeAreaView testID="harbour-screen" style={styles.screen}>
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>
        {harbour}
      </Text>
      <WindBadge knots={knots} />
    </View>
    <ScrollView style={styles.body} contentContainerStyle={styles.content}>
      <TideTime time="14:32" height={4.2} />
      <TaskList tasks={tasks} />
    </ScrollView>
    <View testID="tab-bar" style={styles.tabBar}>
      <Text style={styles.tab}>Today</Text>
      <Text style={styles.tab}>Crew</Text>
      <Text style={styles.tab}>Charts</Text>
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f7f9" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  title: { fontSize: 24, fontWeight: "700", color: "#10212c" },
  body: { flex: 1 },
  content: { gap: 16, padding: 16 },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#d8e2ea",
    backgroundColor: "#ffffff"
  },
  tab: { color: "#2a6f97", fontWeight: "600" }
});
