/**
 * A round button with an Ionicons icon from `@expo/vector-icons`: the icon is a glyph of a font Expo loads, as on a
 * phone.
 *
 * @module
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, type PressableProps, StyleSheet } from "react-native";

/** The button's props: its own, and those of React Native's `Pressable` (`hitSlop`, `delayLongPress`…). */
export type IconButtonProps = Omit<PressableProps, "children" | "style" | "onPress"> & {
  /** The icon, by its Ionicons name. */
  readonly icon: ComponentProps<typeof Ionicons>["name"];
  /** What the button does, for a screen reader. */
  readonly label: string;
  /** How large the icon is, in points; 24 by default. */
  readonly size?: number;
  /** Called when the button is pressed. */
  readonly onPress?: () => void;
};

/**
 * A round icon button.
 *
 * @param props - the button's props.
 */
export const IconButton = ({ icon, label, size = 24, onPress, ...pressable }: IconButtonProps): ReactNode => (
  <Pressable
    {...pressable}
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={styles.button}
  >
    <Ionicons name={icon} size={size} color="#ffffff" />
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    padding: 12,
    borderRadius: 999,
    backgroundColor: "#2a6f97"
  }
});
