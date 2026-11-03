/**
 * A Lit element named by its tag, with a subcomponent named by its class.
 *
 * @module
 */
import "./UiBadge.ts";

import { UiPlain } from "./UiPlain.ts";

export default { title: "Docs/Badge", component: "ui-badge", subcomponents: { Plain: UiPlain } };

/** A badge. */
export const Default = { args: { label: "New" } };
