/**
 * A tag of a crew member's skill, styled with NativeWind: Tailwind's classes on React Native's components, as the app
 * writes them.
 *
 * @module
 */
import type { ReactNode } from "react";
import { Text, View } from "react-native";

/** The chip's props. */
export type TagChipProps = {
  /** The skill. */
  readonly label: string;
  /** Whether it is the member's main skill, drawn filled; `false` by default. */
  readonly isMain?: boolean;
};

/**
 * A skill's chip.
 *
 * @param props - the chip's props.
 */
export const TagChip = ({ label, isMain = false }: TagChipProps): ReactNode => (
  <View
    testID="tag-chip"
    className={`self-start rounded-full border-2 border-harbour px-3 py-1 ${isMain ? "bg-harbour" : "bg-foam dark:bg-slate-800"}`}
  >
    <Text testID="tag-label" className={`text-sm font-semibold ${isMain ? "text-white" : "text-harbour"}`}>
      {label}
    </Text>
  </View>
);
