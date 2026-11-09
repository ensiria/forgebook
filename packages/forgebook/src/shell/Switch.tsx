/**
 * A boolean's switch, in the Props tab's fields and in the nested fields of the value editors.
 *
 * @remarks
 * A native checkbox drawn as a switch (`role="switch"`, `.forgebook-switch`): it keeps Space, the label and the
 * disabled state of a checkbox, and Enter turns it as well, as a switch's button would.
 *
 * @module
 */
import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";

/** What a switch shows and calls. */
export type SwitchProps = {
  /** Its accessible name. */
  readonly label: string;
  /** Whether it is on. */
  readonly isOn: boolean;
  /** The id of the text that describes it, when there is one. */
  readonly describedBy?: string | undefined;
  /** Whether it cannot be turned: a value the type fixes. */
  readonly disabled?: boolean | undefined;
  /** Called with the new state. */
  readonly onChange: (isOn: boolean) => void;
};

/**
 * The switch.
 *
 * @param props - its name, state and setter.
 */
export const Switch = ({ label, isOn, describedBy, disabled, onChange }: SwitchProps): ReactNode => (
  <input
    type="checkbox"
    role="switch"
    className="forgebook-switch"
    aria-label={label}
    aria-checked={isOn}
    aria-describedby={describedBy}
    checked={isOn}
    disabled={disabled}
    onChange={(event: ChangeEvent<HTMLInputElement>): void => onChange(event.target.checked)}
    onKeyDown={(event: KeyboardEvent<HTMLInputElement>): void => {
      // a click turns it as Space does, through its change
      if (event.key === "Enter") event.currentTarget.click();
    }}
  />
);
