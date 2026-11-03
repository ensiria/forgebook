/**
 * A note on the platform the app runs on, read from `Platform`: the phone's variant. The browser reads
 * `PlatformNote.web.tsx` instead, as Metro does for the web.
 *
 * @module
 */
import type { ReactNode } from "react";
import { Platform, Text } from "react-native";

/** The note's props. */
export type PlatformNoteProps = {
  /** What comes before the platform's name. */
  readonly prefix?: string;
};

/**
 * The platform's note, as a phone draws it.
 *
 * @param props - the note's props.
 */
export const PlatformNote = ({ prefix = "Running on" }: PlatformNoteProps): ReactNode => (
  <Text>{`${prefix} ${Platform.OS} (native file)`}</Text>
);
