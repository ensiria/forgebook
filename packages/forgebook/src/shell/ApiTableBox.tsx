/**
 * The box around a table of the API reference: a table wider than the page scrolls in it, never the page, by the
 * pointer or from its Tab stop.
 *
 * @module
 */
import type { ReactNode } from "react";

import { useScrollStops } from "./useScrollStops.ts";

/**
 * A table's box.
 *
 * @param props - the table.
 */
export const ApiTableBox = ({ children }: { readonly children: ReactNode }): ReactNode => {
  const boxRef = useScrollStops();
  return (
    <div ref={boxRef} className="forgebook-api">
      {children}
    </div>
  );
};
