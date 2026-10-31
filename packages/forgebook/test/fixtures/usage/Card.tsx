/**
 * A box around what it is given: its stories render Badge themselves.
 *
 * @module
 */
import type { ReactNode } from "react";

/**
 * A card.
 *
 * @param props - its content.
 */
export const Card = ({ children }: { readonly children?: ReactNode }): ReactNode => (
  <section>{children}</section>
);
