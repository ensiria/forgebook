/**
 * The panel's Interactions tab: the story's play function as it ran, whether it passed or where it failed, each step
 * it named with `step`, and a button that runs it again on a fresh mount.
 *
 * @module
 */
import type { ReactNode } from "react";

import type { PlayStatus, PlayTrace } from "../playTrace";
import { STRINGS } from "./strings";

/** The tab's props. */
export type InteractionsTabProps = {
  /** The play's trace. */
  readonly trace: PlayTrace;
  /** Runs the play again on a fresh mount. */
  readonly onPlayAgain: () => void;
};

/**
 * The tab's hint: the play's status.
 *
 * @param trace - the trace.
 */
export const interactionsHint = (trace: PlayTrace): string => STRINGS.playStatus[trace.status];

/** A status with its time, as a line ends. */
const StatusNote = ({
  status,
  ms
}: {
  readonly status: PlayStatus;
  readonly ms: number | undefined;
}): ReactNode => (
  <span className="forgebook-play__status" data-status={status}>
    {STRINGS.playStatus[status]}
    {ms === undefined ? null : ` · ${STRINGS.playTime(ms)}`}
  </span>
);

/**
 * The Interactions tab.
 *
 * @param props - the trace and how to run the play again.
 */
export const InteractionsTab = ({ trace, onPlayAgain }: InteractionsTabProps): ReactNode => (
  <div className="forgebook-prop-group" aria-live="polite">
    <div className="forgebook-calls__head">
      <h3 className="forgebook-prop-group__title">
        {STRINGS.playTitle} <StatusNote status={trace.status} ms={trace.ms} />
      </h3>
      <button
        type="button"
        className="forgebook-button"
        disabled={trace.status === "running"}
        onClick={onPlayAgain}
      >
        {STRINGS.playAgain}
      </button>
    </div>
    {trace.error === undefined ? null : (
      <p className="forgebook-problems" role="alert">
        {trace.error}
      </p>
    )}
    {trace.steps.length === 0 ? (
      <p className="forgebook-prop__description">{STRINGS.playNoSteps}</p>
    ) : (
      <ol className="forgebook-play__steps">
        {trace.steps.map((step, index) => (
          // a step's place is its identity: a play may name two steps alike
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <li key={index} className="forgebook-play__step" data-status={step.status}>
            <span className="forgebook-play__label">{step.label}</span>
            <StatusNote status={step.status} ms={step.ms} />
            {step.error === undefined ? null : <p className="forgebook-play__error">{step.error}</p>}
          </li>
        ))}
      </ol>
    )}
  </div>
);
