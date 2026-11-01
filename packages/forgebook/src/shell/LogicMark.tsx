/**
 * The mark of a page about logic (`parameters.logic`): a hook's or a function's, beside its title, with what it means
 * in its tooltip.
 *
 * @module
 */
import type { ReactNode } from "react";

import { Icon } from "./icons.tsx";
import { STRINGS } from "./strings.ts";

/** The mark. */
export const LogicMark = (): ReactNode => (
  <span className="forgebook-logic-mark" title={STRINGS.logicHint}>
    <Icon name="function" size={12} />
    {STRINGS.logic}
  </span>
);
