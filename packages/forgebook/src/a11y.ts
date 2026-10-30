/**
 * The accessibility check of a story: the axe rules every story passes, the same in the generated tests and in the
 * catalogue's Accessibility card, and a violation as the card shows it.
 *
 * @remarks
 * The card runs the check in the story's frame, on what the story shows at that moment (an open menu, a dark theme),
 * so a problem is seen while the story is written, not first in CI.
 *
 * @module
 */

/** The axe rules every story passes: WCAG 2.2 at levels A and AA. */
export const AXE_TAGS: readonly string[] = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** How bad a violation is, as axe rates it. */
export type ViolationImpact = "minor" | "moderate" | "serious" | "critical";

/** One rule a story breaks. */
export type Violation = {
  /** The rule's id (`color-contrast`). */
  readonly id: string;
  /** What the rule asks, in a sentence. */
  readonly help: string;
  /** How bad it is; none when axe does not say. */
  readonly impact: ViolationImpact | undefined;
  /** The page explaining the rule. */
  readonly helpUrl: string;
  /** A selector of each element that breaks it. */
  readonly targets: readonly string[];
};

/** Whether a value is a violation, as it arrives in a message. */
export const isViolation = (value: unknown): value is Violation => {
  if (typeof value !== "object" || value === null) return false;
  const record: Readonly<Record<string, unknown>> = { ...value };
  const impact = record["impact"];
  const targets = record["targets"];
  return (
    typeof record["id"] === "string" &&
    typeof record["help"] === "string" &&
    typeof record["helpUrl"] === "string" &&
    (impact === undefined ||
      impact === "minor" ||
      impact === "moderate" ||
      impact === "serious" ||
      impact === "critical") &&
    Array.isArray(targets) &&
    targets.every((target) => typeof target === "string")
  );
};
