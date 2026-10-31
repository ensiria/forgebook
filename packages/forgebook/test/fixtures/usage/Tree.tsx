/**
 * A list of rows: its stories render Tree only, and use Row and Badge through it.
 *
 * @module
 */
import type { ReactNode } from "react";

import { Row } from "./Row.tsx";

/**
 * A tree.
 *
 * @param props - its items.
 */
export const Tree = ({ items }: { readonly items: readonly string[] }): ReactNode => (
  <ul>
    {items.map((item) => (
      <Row key={item} label={item} />
    ))}
  </ul>
);
