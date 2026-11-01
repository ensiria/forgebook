/**
 * A box around what it is given: its stories render Badge themselves.
 *
 * @module
 */
import type { ReactNode } from "react";

// a type renders nothing: taking one from Lonely does not use Lonely
import type { Lonely } from "./Lonely.tsx";

/** The kind of the component this card never renders, read for its type only. */
export type NotRendered = typeof Lonely;

/**
 * A card.
 *
 * @param props - its content.
 */
export const Card = ({ children }: { readonly children?: ReactNode }): ReactNode => (
  <section>{children}</section>
);
