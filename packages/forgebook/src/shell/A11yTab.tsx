/**
 * The panel's Accessibility tab: checks the story as it is now (after a click, in the dark theme) with the rules of
 * the generated tests, and lists each rule it breaks with the elements that break it.
 *
 * @remarks
 * A result belongs to the story and the view it was taken in: the stage clears it when either changes, so an old
 * result never shows over a new story.
 *
 * @module
 */
import type { ReactNode } from "react";

import type { Violation } from "../a11y.ts";
import { STRINGS } from "./strings.ts";

/** The check's state: not run, running, its violations, or why it could not run. */
export type CheckState =
  | { readonly status: "idle" }
  | { readonly status: "running" }
  | { readonly status: "done"; readonly violations: readonly Violation[] }
  | { readonly status: "error"; readonly message: string };

/** The tab's props. */
export type A11yTabProps = {
  /** The check's state. */
  readonly check: CheckState;
  /** Runs the check; none when it cannot run (the compare view). */
  readonly onCheck: (() => void) | undefined;
};

/**
 * The tab's hint: how many rules are broken once checked.
 *
 * @param check - the check's state.
 */
export const a11yHint = (check: CheckState): string | undefined => {
  if (check.status !== "done") return undefined;
  return check.violations.length === 0 ? STRINGS.a11yPasses : STRINGS.a11yCount(check.violations.length);
};

/** What the check found. */
const CheckResult = ({ check }: { readonly check: CheckState }): ReactNode => {
  if (check.status === "error") {
    return (
      <p className="forgebook-problems" role="alert">
        {STRINGS.a11yError}: {check.message}
      </p>
    );
  }
  if (check.status !== "done") return null;
  if (check.violations.length === 0) return <p className="forgebook-prop__description">{STRINGS.a11yNone}</p>;
  return (
    <ul className="forgebook-violations">
      {check.violations.map((violation) => (
        <li key={violation.id} className="forgebook-violation" data-impact={violation.impact}>
          <div className="forgebook-violation__head">
            <a className="forgebook-violation__rule" href={violation.helpUrl} target="_blank" rel="noopener">
              {violation.id}
            </a>
            {violation.impact === undefined ? null : (
              <span className="forgebook-violation__impact">{violation.impact}</span>
            )}
          </div>
          <p className="forgebook-prop__description">{violation.help}</p>
          <ul className="forgebook-violation__targets">
            {violation.targets.map((target) => (
              <li key={target}>
                <code>{target}</code>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
};

/**
 * The Accessibility tab.
 *
 * @param props - the check's state and how to run it.
 */
export const A11yTab = ({ check, onCheck }: A11yTabProps): ReactNode => (
  <div className="forgebook-prop-group">
    <div className="forgebook-calls__head">
      <button
        type="button"
        className="forgebook-button"
        disabled={onCheck === undefined || check.status === "running"}
        onClick={onCheck}
      >
        {check.status === "running" ? STRINGS.a11yRunning : STRINGS.a11yCheck}
      </button>
      {onCheck === undefined ? (
        <span className="forgebook-popover__note">{STRINGS.a11yNotInCompare}</span>
      ) : null}
    </div>
    <div aria-live="polite">
      <CheckResult check={check} />
    </div>
  </div>
);
