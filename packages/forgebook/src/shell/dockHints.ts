/**
 * What a story's panel shows of a tab before the tab itself loads: its hint, and whether it has anything to show. The
 * tabs a story does not open on load late (`dockTabs.tsx`), and these are read to draw the row of tabs.
 *
 * @module
 */
import type { ComponentDocs } from "../componentDocs.ts";
import type { PlayTrace } from "../playTrace.ts";
import type { TreeStory } from "../storyTree.ts";
import type { CheckState } from "./A11yTab.tsx";
import { STRINGS } from "./strings.ts";

/** The props that carry a component's modifiers, each mirrored by a `data-*` styling hook. */
const MODIFIERS = ["variant", "size", "tone", "shape", "width", "orientation"];

/**
 * The `data-*` hooks of a component's modifiers.
 *
 * @param docs - the component's docs.
 */
export const styleHooks = (docs: ComponentDocs): string[] =>
  docs.props
    .filter((prop) => prop.kind === "choice" && MODIFIERS.includes(prop.name))
    .map((prop) => `data-${prop.name}="${(prop.choices ?? []).join(" | ")}"`);

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

/**
 * Whether a story's args change what it draws: not for a story of fixed examples, nor for one about logic, whose scene
 * takes none.
 *
 * @param story - the story.
 */
export const takesArgs = (story: Pick<TreeStory, "isLogic" | "controls">): boolean =>
  !story.isLogic && (story.controls === "all" || story.controls.length > 0);
