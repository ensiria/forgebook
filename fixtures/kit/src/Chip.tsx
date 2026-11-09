/**
 * A chip with a text and an icon at either end: one icon prop typed through an alias of `IconComponent`, one optional,
 * so the kit's icon picker is matched through both.
 *
 * @module
 */
import type { ReactNode } from "react";

import type { IconComponent } from "./icons";

/** The icon at a chip's start: an alias of the kit's icon type. */
export type ChipIcon = IconComponent;

/** The chip's props. */
export type ChipProps = {
  /** Its text. */
  readonly label: string;
  /** The icon before the text; none by default. */
  readonly startIcon?: ChipIcon;
  /** The icon after the text; none by default. */
  readonly endIcon?: IconComponent | undefined;
};

/**
 * A chip.
 *
 * @param props - its text and its icons.
 */
export const Chip = ({ label, startIcon: Start, endIcon: End }: ChipProps): ReactNode => (
  <span className="kit-chip" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
    {Start === undefined ? null : <Start />}
    {label}
    {End === undefined ? null : <End />}
  </span>
);
