/**
 * A short label beside what it describes.
 *
 * @module
 */
import type { ComponentChildren, VNode } from "preact";

/** The badge's props. */
export type BadgeProps = {
  /** The text shown. */
  readonly label: string;
  /** How loud the badge is. */
  readonly tone?: "info" | "danger";
  /** A count after the label. */
  readonly count?: number;
  /** Called when the person takes the badge away. */
  readonly onRemove?: (reason: string) => void;
  /** What goes after the label. */
  readonly children?: ComponentChildren;
};

/**
 * A short label.
 *
 * @param props - the badge's props.
 */
export const Badge = ({ label, tone = "info", count, onRemove, children }: BadgeProps): VNode => (
  <span class={`badge badge--${tone}`}>
    {label}
    {count === undefined ? null : ` ${count}`}
    {children}
    {onRemove === undefined ? null : (
      <button type="button" onClick={(): void => onRemove("button")}>
        Remove
      </button>
    )}
  </span>
);
