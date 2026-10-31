/**
 * A row with a badge, rendered by Tree: Badge is used through it.
 *
 * @module
 */
import type { ReactNode } from "react";

import { Badge } from "./Badge.tsx";

/**
 * A row.
 *
 * @param props - its label.
 */
export const Row = ({ label }: { readonly label: string }): ReactNode => (
  <div>
    <Badge label={label} />
  </div>
);
