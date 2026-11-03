/**
 * A short label beside what it describes.
 *
 * @module
 */
import { type JSX, Show } from "solid-js";

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
  readonly children?: JSX.Element;
};

/**
 * A short label.
 *
 * @param props - the badge's props.
 */
export const Badge = (props: BadgeProps): JSX.Element => (
  <span class={`badge badge--${props.tone ?? "info"}`}>
    {props.label}
    <Show when={props.count !== undefined}> {props.count}</Show>
    {props.children}
    <Show when={props.onRemove}>
      {(onRemove: () => (reason: string) => void): JSX.Element => (
        <button type="button" onClick={(): void => onRemove()("button")}>
          Remove
        </button>
      )}
    </Show>
  </span>
);
