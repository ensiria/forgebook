/**
 * A crew member's card: an avatar, a name and a role, an online dot, and a Follow button. Written with React Native's
 * own components, the avatar `require`d as React Native names an image.
 *
 * @module
 */
import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

/** The card's props. */
export type ProfileCardProps = {
  /** The member's name. */
  readonly name: string;
  /** What they do on board. */
  readonly role: string;
  /** Whether they are online, which shows a green dot; `false` by default. */
  readonly isOnline?: boolean;
  /** How the card is drawn; `"plain"` by default. */
  readonly tone?: "plain" | "accent";
  /** Called when Follow is pressed. */
  readonly onFollow?: (name: string) => void;
};

/**
 * A crew member's card.
 *
 * @param props - the card's props.
 */
export const ProfileCard = ({
  name,
  role,
  isOnline = false,
  tone = "plain",
  onFollow
}: ProfileCardProps): ReactNode => (
  <View style={[styles.card, tone === "accent" && styles.accent]}>
    <View>
      <Image
        accessibilityLabel={`${name}'s avatar`}
        source={require("./assets/avatar.png")}
        style={styles.avatar}
      />
      {isOnline ? <View testID="online-dot" style={styles.dot} /> : null}
    </View>
    <View style={styles.text}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.role}>{role}</Text>
    </View>
    <Pressable
      accessibilityRole="button"
      onPress={(): void => onFollow?.(name)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.buttonText}>Follow</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8e2ea"
  },
  accent: { backgroundColor: "#e8f3fa", borderColor: "#2a6f97" },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  dot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "#2fb344"
  },
  text: { flex: 1 },
  name: { fontSize: 17, fontWeight: "600", color: "#10212c" },
  role: { fontSize: 14, color: "#4a5d6b" },
  button: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#2a6f97" },
  pressed: { opacity: 0.7 },
  buttonText: { color: "#ffffff", fontWeight: "600" }
});
