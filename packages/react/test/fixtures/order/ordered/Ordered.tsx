/**
 * A component whose props write their values in every form the docs read in source order.
 *
 * @module
 */
import type { ReactNode } from "react";

import type { SharedProps } from "../shared/sharedProps.ts";

/** The sizes, in the order the source writes them: not the alphabet's. */
export const SIZES = ["md", "sm"] as const;

/** The styles, keyed in the order the object writes them. */
export const STYLES = { body: 1, caption: 2, badge: 3 } as const;

/** The variants. */
export type Variant = "default" | "grid" | "changes";

/** The ordered component's props: its own, in two branches, and the shared ones. */
export type OrderedProps = SharedProps & {
  /** Written last in the source, listed after the others of this file. */
  readonly label: ReactNode;
  /** A tuple's member. */
  readonly size?: (typeof SIZES)[number];
  /** An object's key. */
  readonly textStyle?: keyof typeof STYLES;
  /** A generic over the variants. */
  readonly variant?: Exclude<Variant, "changes">;
  /** Another type's prop. */
  readonly opens?: SharedProps["side"];
} & ({ readonly indicator?: never } | { readonly indicator?: "spinner" | "dot" });

/**
 * The ordered component.
 *
 * @param props - its props.
 */
export const Ordered = (props: OrderedProps): ReactNode => props.label;
