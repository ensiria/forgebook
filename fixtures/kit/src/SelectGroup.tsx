/**
 * A group of a select's options, under a label: the fixture's part with no story file of its own, named in the
 * select's `subcomponents`.
 *
 * @module
 */
import type { ReactNode } from "react";

/** A group's props. */
export type SelectGroupProps = {
  /** The group's label, above its options. */
  readonly label: string;
  /** Whether the group starts folded. @defaultValue `false` */
  readonly isFolded?: boolean;
  /** Called when the group is folded or unfolded. */
  readonly onFoldChange?: (isFolded: boolean) => void;
  /** The options. */
  readonly children?: ReactNode;
};

/**
 * Groups a select's options under a label.
 *
 * @param props - the group's props.
 */
export const SelectGroup = ({ label, children }: SelectGroupProps): ReactNode => (
  <fieldset>
    <legend>{label}</legend>
    {children}
  </fieldset>
);
