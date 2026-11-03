/**
 * What the panel's row of tabs shows of a tab before its content is drawn: its hint, and whether it has anything to
 * show.
 *
 * @remarks
 * Apart from the tabs themselves, whose modules load the first time each is chosen (`dockTabs`): the row is on every
 * story's page, a tab's content only once it is chosen.
 *
 * @module
 */
import type { ComponentDocs } from "../componentDocs.ts";
import type { PlayTrace } from "../playTrace.ts";
import type { CheckState } from "./A11yTab.tsx";
import { STRINGS } from "./strings.ts";

/**
 * The Accessibility tab's hint: how many rules are broken once checked.
 *
 * @param check - the check's state.
 */
export const a11yHint = (check: CheckState): string | undefined => {
  if (check.status !== "done") return undefined;
  return check.violations.length === 0 ? STRINGS.a11yPasses : STRINGS.a11yCount(check.violations.length);
};

/**
 * The Interactions tab's hint: the play's status.
 *
 * @param trace - the trace.
 */
export const interactionsHint = (trace: PlayTrace): string => STRINGS.playStatus[trace.status];

/** The props that carry a component's modifiers, each mirrored by a `data-*` styling hook. */
const MODIFIERS = ["variant", "size", "tone", "shape", "width", "orientation"];

/**
 * The `data-*` hooks of a component's modifiers, which the Parts and styling tab lists.
 *
 * @param docs - the component's docs.
 */
export const styleHooks = (docs: ComponentDocs): string[] =>
  docs.props
    .filter((prop) => prop.kind === "choice" && MODIFIERS.includes(prop.name))
    .map((prop) => `data-${prop.name}="${(prop.choices ?? []).join(" | ")}"`);
