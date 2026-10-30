/**
 * A segmented choice built on native radio buttons, so the arrow keys, the form semantics and screen readers work
 * as they do for any radio group.
 *
 * @module
 */
import { type ReactNode, useId } from "react";

import { Icon, type IconName } from "./icons.tsx";

/** One option. */
export type SegmentOption<TValue extends string | number> = {
  /** The value. */
  readonly value: TValue;
  /** The visible label, or the accessible name when the option shows an icon. */
  readonly label: string;
  /** An icon instead of the label. */
  readonly icon?: IconName;
};

/** The segmented choice's props. */
export type SegmentedProps<TValue extends string | number> = {
  /** The group's name, for screen readers. */
  readonly label: string;
  /** The options, in order. */
  readonly options: readonly SegmentOption<TValue>[];
  /** The chosen value. */
  readonly value: TValue;
  /** Called with the chosen value. */
  readonly onValueChange: (value: TValue) => void;
  /** Whether the choice is off (the compare view fixes the theme); `false` by default. */
  readonly isDisabled?: boolean;
  /** Why the choice is off, as its tooltip (the story sets it); none by default. */
  readonly disabledNote?: string | undefined;
  /** What closes the group inside its frame (the width's field after its presets); none by default. */
  readonly after?: ReactNode;
};

/**
 * A segmented choice.
 *
 * @param props - the options and the chosen value.
 */
export const Segmented = <TValue extends string | number>({
  label,
  options,
  value,
  onValueChange,
  isDisabled = false,
  disabledNote,
  after
}: SegmentedProps<TValue>): ReactNode => {
  const name = useId();
  return (
    <fieldset
      className="forgebook-segmented"
      disabled={isDisabled}
      title={isDisabled ? disabledNote : undefined}
    >
      <legend className="forgebook-visually-hidden">{label}</legend>
      {options.map((option) => (
        <label
          key={String(option.value)}
          className="forgebook-segmented__option"
          title={option.icon ? option.label : undefined}
        >
          <input
            type="radio"
            className="forgebook-visually-hidden"
            name={name}
            checked={option.value === value}
            aria-label={option.icon ? option.label : undefined}
            onChange={() => onValueChange(option.value)}
          />
          <span className="forgebook-segmented__face">
            {option.icon ? <Icon name={option.icon} size={14} /> : option.label}
          </span>
        </label>
      ))}
      {after}
    </fieldset>
  );
};
