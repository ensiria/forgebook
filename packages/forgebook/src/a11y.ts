/**
 * A violation of the accessibility check of a story, as the catalogue's Accessibility card shows it; the rules
 * checked are the catalogue's (`catalogue.ts`, WCAG 2.2 A and AA by default), the same in the generated tests.
 *
 * @remarks
 * The card runs the check in the story's frame, on what the story shows at that moment (an open menu, a dark theme),
 * so a problem is seen while the story is written, not first in CI.
 *
 * @module
 */

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
