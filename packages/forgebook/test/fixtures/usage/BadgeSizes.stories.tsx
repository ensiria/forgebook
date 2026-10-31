/**
 * More of Badge's stories, in a file of their own: the same component, never a user of itself.
 *
 * @module
 */
import type { ReactNode } from "react";

import { Badge } from "./Badge.tsx";

export default { title: "Data/Badge sizes", component: Badge };

/** A long label. */
export const Long = { render: (): ReactNode => <Badge label="A label long enough to wrap" /> };
