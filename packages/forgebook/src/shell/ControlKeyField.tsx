/**
 * A control's key in its View row: the key shown, and a press on it records another (Backspace takes it away, Escape
 * keeps it). A key the shell or another control has is refused, the reason said in place.
 *
 * @module
 */
import { type KeyboardEvent, type ReactNode, useState } from "react";

import { keyOf } from "../controlKeys.ts";
import { LATER_STRINGS } from "./laterStrings.ts";

/** The keys that take a control's key away while one is recorded. */
const REMOVE_KEYS = ["Backspace", "Delete"];

/**
 * The key field.
 *
 * @param props - the control's name, its key, and what gives it another.
 */
export const ControlKeyField = ({
  label,
  shortcut,
  onKeyChange
}: {
  /** The control's name, for the field's own. */
  readonly label: string;
  /** Its key; none when it has none. */
  readonly shortcut: string | undefined;
  /** Gives it another key (`null` takes it away); answers why a key cannot be given. */
  readonly onKeyChange: (key: string | null) => string | undefined;
}): ReactNode => {
  const [isRecording, setIsRecording] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const record = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (!isRecording || event.key === "Tab") return;
    // the press is the field's: neither the controls' keys nor the menu's Escape see it
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setIsRecording(false);
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = REMOVE_KEYS.includes(event.key) ? null : keyOf(event.key);
    if (key === undefined) return;
    const refused = onKeyChange(key);
    setProblem(refused);
    if (refused === undefined) setIsRecording(false);
  };
  return (
    <span className="forgebook-key-field">
      <button
        type="button"
        className="forgebook-key-field__button"
        aria-label={LATER_STRINGS.controlKey(label, shortcut)}
        aria-pressed={isRecording}
        title={isRecording ? LATER_STRINGS.pressAKey : LATER_STRINGS.changeKey}
        onClick={(): void => {
          setProblem(undefined);
          setIsRecording(!isRecording);
        }}
        onBlur={(): void => setIsRecording(false)}
        onKeyDown={record}
      >
        {isRecording ? LATER_STRINGS.pressAKey : <kbd>{shortcut?.toUpperCase() ?? "–"}</kbd>}
      </button>
      <span className="forgebook-key-field__problem" role="status">
        {problem ?? ""}
      </span>
    </span>
  );
};
