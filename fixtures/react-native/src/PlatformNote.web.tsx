/**
 * The web's variant of the platform note: what the browser draws, since a `.web.tsx` file wins over the plain one.
 *
 * @module
 */
import type { ReactNode } from "react";
import { Platform, Text } from "react-native";

import type { PlatformNoteProps } from "./PlatformNote";

/**
 * The platform's note, as the browser draws it.
 *
 * @param props - the note's props.
 */
export const PlatformNote = ({ prefix = "Running on" }: PlatformNoteProps): ReactNode => (
  <Text testID="platform-note">{`${prefix} ${Platform.OS} (${Platform.select({ web: "web file", default: "other" })})`}</Text>
);
