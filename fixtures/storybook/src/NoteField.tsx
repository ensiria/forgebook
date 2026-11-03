/**
 * A labelled field: what the hot-edit stories draw, so a test can type into it and see the text stay.
 *
 * @module
 */
import type { ReactNode } from "react";

/** The field's props. */
export type NoteFieldProps = {
  /** The text above the field. */
  readonly label: string;
};

/**
 * A labelled text field.
 *
 * @param props - the label.
 */
export const NoteField = ({ label }: NoteFieldProps): ReactNode => (
  <label>
    {label}
    <input aria-label="Note" />
  </label>
);
