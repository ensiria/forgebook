/**
 * The matrix's axes in the story's bar: the prop the rows take their values from, and the columns' when there are
 * two. None draws the story alone.
 *
 * @module
 */
import { type ChangeEvent, type ReactNode, useId } from "react";

import type { PropDocs } from "../componentDocs";
import { STRINGS } from "./strings";

/** The picker's props. */
export type MatrixPickerProps = {
  /** The props that can make an axis. */
  readonly props: readonly PropDocs[];
  /** The chosen axes' names: the rows', then the columns'. */
  readonly axes: readonly string[];
  /** Called with the chosen axes; empty draws the story alone. */
  readonly onAxesChange: (axes: readonly string[]) => void;
};

/**
 * The matrix's axes.
 *
 * @param props - the props that can make an axis, the chosen ones and the setter.
 */
export const MatrixPicker = ({ props, axes, onAxesChange }: MatrixPickerProps): ReactNode => {
  const rowsId = useId();
  const columnsId = useId();
  const [rows = "", columns = ""] = axes;
  return (
    <div className="forgebook-matrix-picker">
      <label htmlFor={rowsId} className="forgebook-popover__label">
        {STRINGS.matrix}
      </label>
      <select
        id={rowsId}
        className="forgebook-select"
        data-set={rows === "" ? undefined : ""}
        value={rows}
        onChange={(event: ChangeEvent<HTMLSelectElement>): void => {
          const next = event.currentTarget.value;
          onAxesChange(next === "" ? [] : [next, ...(columns === "" || columns === next ? [] : [columns])]);
        }}
      >
        <option value="">{STRINGS.matrixNone}</option>
        {props.map((prop) => (
          <option key={prop.name} value={prop.name}>
            {prop.name}
          </option>
        ))}
      </select>
      <span aria-hidden="true">×</span>
      <select
        id={columnsId}
        className="forgebook-select"
        aria-label={STRINGS.matrixColumns}
        data-set={columns === "" ? undefined : ""}
        value={columns}
        disabled={rows === ""}
        onChange={(event: ChangeEvent<HTMLSelectElement>): void => {
          const next = event.currentTarget.value;
          onAxesChange(next === "" ? [rows] : [rows, next]);
        }}
      >
        <option value="">{STRINGS.matrixNone}</option>
        {props
          .filter((prop) => prop.name !== rows)
          .map((prop) => (
            <option key={prop.name} value={prop.name}>
              {prop.name}
            </option>
          ))}
      </select>
    </div>
  );
};
