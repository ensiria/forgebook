/**
 * A select for the catalogue's tests: one value picked from a list, in three sizes.
 *
 * @module
 */
import type { ChangeEvent, ComponentProps, ReactNode } from "react";

/** The select's parts. */
type SelectPart = "root" | "trigger" | "list";

/** The select's props. */
export type SelectProps = Omit<ComponentProps<"div">, "onChange"> & {
  /**
   * The chosen value, when controlled.
   *
   * Further detail that the summary leaves out.
   */
  readonly value?: string;
  /** The size. @defaultValue `"md"` */
  readonly size?: "sm" | "md" | "lg";
  /** The number of visible rows. */
  readonly rows?: number;
  /** Whether it is off. @defaultValue `false` */
  readonly isDisabled?: boolean;
  /** Called with the new value, not the event. */
  readonly onValueChange?: (value: string) => void;
  /** The options. */
  readonly options: readonly string[];
  /** A hint under the select: a text or any node. */
  readonly hint?: ReactNode;
  /** A class per part. */
  readonly classNames?: Partial<Record<SelectPart, string>>;
};

/**
 * Lets the user pick one value from a list.
 *
 * @useWhen The list is short and its values are known.
 * @avoidWhen Most of the choices should stay in sight: use radio buttons.
 * @alternatives Combobox, RadioGroup
 * @param props - the select's props.
 */
export const Select = ({
  value,
  size = "md",
  isDisabled = false,
  onValueChange,
  options,
  hint
}: SelectProps): ReactNode => (
  <>
    <select
      value={value}
      disabled={isDisabled}
      data-size={size}
      onChange={(event: ChangeEvent<HTMLSelectElement>): void => onValueChange?.(event.target.value)}
    >
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
    {hint === undefined ? null : <small>{hint}</small>}
  </>
);
