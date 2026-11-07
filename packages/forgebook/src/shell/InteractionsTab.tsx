/**
 * The panel's Interactions tab: the story's play function as it ran, whether it passed or where it failed, each step
 * it named with `step`, and a button that runs it again on a fresh mount.
 *
 * @module
 */
import type { ChangeEvent, ReactNode } from "react";

import type { PlayStatus, PlayTrace } from "../playTrace.ts";
import type { ViewState } from "../viewState.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { LATER_STRINGS } from "./laterStrings.ts";
import { rememberPlay } from "./playMemory.ts";
import { STRINGS } from "./strings.ts";

/** The tab's props. */
export type InteractionsTabProps = {
  /** The play's trace. */
  readonly trace: PlayTrace;
  /** Runs the play again on a fresh mount. */
  readonly onPlayAgain: () => void;
  /** The view, whose play switch it shows. */
  readonly view: ViewState;
  /** Changes the view. */
  readonly onViewChange: (view: ViewState) => void;
};

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
    {ms === undefined ? null : ` · ${LATER_STRINGS.playTime(ms)}`}
  </span>
);

/**
 * The Interactions tab.
 *
 * @param props - the trace and how to run the play again.
 */
export const InteractionsTab = ({
  trace,
  onPlayAgain,
  view,
  onViewChange
}: InteractionsTabProps): ReactNode => {
  const catalogue = useCatalogue();
  return (
    <div className="forgebook-prop-group" aria-live="polite">
      <div className="forgebook-calls__head">
        <h3 className="forgebook-prop-group__title">
          {LATER_STRINGS.playTitle} <StatusNote status={trace.status} ms={trace.ms} />
        </h3>
        <button
          type="button"
          className="forgebook-button"
          disabled={trace.status === "running"}
          onClick={onPlayAgain}
        >
          {trace.status === "off" ? LATER_STRINGS.playRun : LATER_STRINGS.playAgain}
        </button>
      </div>
      <label className="forgebook-play__switch">
        <input
          type="checkbox"
          checked={view.play === "on"}
          onChange={(event: ChangeEvent<HTMLInputElement>): void => {
            const play = event.target.checked ? "on" : "off";
            rememberPlay(catalogue, play);
            onViewChange({ ...view, play });
          }}
        />
        {LATER_STRINGS.playOnOpen}
      </label>
      {trace.error === undefined ? null : (
        <p className="forgebook-problems" role="alert">
          {trace.error}
        </p>
      )}
      {trace.steps.length === 0 ? (
        <p className="forgebook-prop__description">
          {trace.status === "off" ? LATER_STRINGS.playOff : LATER_STRINGS.playNoSteps}
        </p>
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
};
