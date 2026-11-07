/**
 * A select for the catalogue's tests: one value picked from a list, in three sizes.
 *
 * @module
 */
import type { ChangeEvent, ComponentProps, ReactNode } from "react";

/** The select's parts. */
type SelectPart = "root" | "trigger" | "list";

/** The select's texts, each with its own TSDoc: the API reference lists them under the `texts` prop. */
export type SelectTexts = {
  /** Shown in place of the list when there is no option. @defaultValue `"Nothing to pick"` */
  readonly empty?: string;
  /** The list's name for screen readers. */
  readonly listLabel?: string;
};

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
  /**
   * The number of visible rows.
   *
   * @group Behaviour
   */
  readonly rows?: number;
  /**
   * Whether it is off.
   *
   * @defaultValue `false`
   * @group Behaviour
   */
  readonly isDisabled?: boolean;
  /** Called with the new value, not the event. */
  readonly onValueChange?: (value: string) => void;
  /** The options. */
  readonly options: readonly string[];
  /** A hint under the select: a text or any node. */
  readonly hint?: ReactNode;
  /**
   * The texts it shows besides the options.
   *
   * @group Texts
   */
  readonly texts?: SelectTexts;
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
      style={{ padding: 12, outline: "2px solid currentColor" }}
      onChange={(event: ChangeEvent<HTMLSelectElement>): void => onValueChange?.(event.target.value)}
    >
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
    {hint === undefined ? null : <small>{hint}</small>}
  </>
);
