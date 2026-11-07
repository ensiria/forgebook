/**
 * A link or a button, chosen by its `kind`, over a list of items of any type: props whose types the docs cannot read
 * plainly, a discriminated union and a generic, for the API reference's notes.
 *
 * @module
 */
import type { ReactNode } from "react";

/** The action's props: a link's or a button's, and what both take. */
export type ActionProps<TItem> = (
  | {
      /** A link. */
      readonly kind: "link";
      /** Where the link goes. */
      readonly href: string;
    }
  | {
      /** A button. */
      readonly kind: "button";
      /** Called when the button is pressed. */
      readonly onClick: () => void;
    }
) & {
  /** Its text. */
  readonly label: string;
  /** The items it acts on. */
  readonly items?: readonly TItem[];
};

/**
 * A link or a button.
 *
 * @param props - its kind, its target and its text.
 */
export const Action = <TItem,>(props: ActionProps<TItem>): ReactNode =>
  props.kind === "link" ? (
    <a href={props.href}>{props.label}</a>
  ) : (
    <button type="button" onClick={props.onClick}>
      {props.label}
    </button>
  );
