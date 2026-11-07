/**
 * The panel's Interactions tab: the story's play function as it ran, whether it passed or where it failed, each step
 * it named with `step`, each action it took through its context's tools, a button that runs it again on a fresh mount,
 * and a debugger that stops it before each action.
 *
 * @module
 */
import type { ChangeEvent, ReactNode } from "react";

import type { PlayStepCommand } from "../messages.ts";
import type { PlayAction, PlayStatus, PlayTrace } from "../playTrace.ts";
import type { ViewState } from "../viewState.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { LATER_STRINGS } from "./laterStrings.ts";
import { rememberPlay } from "./playMemory.ts";
import { STRINGS } from "./strings.ts";

/** The tab's props. */
export type InteractionsTabProps = {
  /** The play's trace. */
  readonly trace: PlayTrace;
  /** Runs the play again on a fresh mount, or steps through it. */
  readonly onPlayStep: (command: PlayStepCommand) => void;
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

/** Actions, in order; nothing when there are none. */
const ActionList = ({ actions }: { readonly actions: readonly PlayAction[] }): ReactNode =>
  actions.length === 0 ? null : (
    <ol className="forgebook-play__actions">
      {actions.map((action, index) => (
        // an action's place is its identity: a play may do the same thing twice
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <li key={index} className="forgebook-play__action" data-status={action.status}>
          <code className="forgebook-play__label">{action.label}</code>
          <StatusNote status={action.status} ms={action.ms} />
          {action.error === undefined ? null : <p className="forgebook-play__error">{action.error}</p>}
        </li>
      ))}
    </ol>
  );

/** The buttons that run the play: to its end, or one action at a time. */
const PlayButtons = ({ trace, onPlayStep }: InteractionsTabProps): ReactNode =>
  trace.pausedAt === undefined ? (
    <>
      <button
        type="button"
        className="forgebook-button"
        disabled={trace.status === "running"}
        onClick={(): void => onPlayStep("start")}
      >
        {LATER_STRINGS.playStepThrough}
      </button>
      <button
        type="button"
        className="forgebook-button"
        disabled={trace.status === "running"}
        onClick={(): void => onPlayStep("again")}
      >
        {trace.status === "off" ? LATER_STRINGS.playRun : LATER_STRINGS.playAgain}
      </button>
    </>
  ) : (
    <>
      <button type="button" className="forgebook-button" onClick={(): void => onPlayStep("next")}>
        {LATER_STRINGS.playNext}
      </button>
      <button type="button" className="forgebook-button" onClick={(): void => onPlayStep("continue")}>
        {LATER_STRINGS.playContinue}
      </button>
    </>
  );

/**
 * The Interactions tab.
 *
 * @param props - the trace and how to run the play again.
 */
export const InteractionsTab = (props: InteractionsTabProps): ReactNode => {
  const { trace, view, onViewChange } = props;
  const catalogue = useCatalogue();
  const actions = trace.actions ?? [];
  const outside = actions.filter((action) => action.step === undefined);
  return (
    <div className="forgebook-prop-group" aria-live="polite">
      <div className="forgebook-calls__head">
        <h3 className="forgebook-prop-group__title">
          {LATER_STRINGS.playTitle} <StatusNote status={trace.status} ms={trace.ms} />
        </h3>
        <div className="forgebook-play__buttons">
          <PlayButtons {...props} />
        </div>
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
      {trace.pausedAt === undefined ? null : (
        <p className="forgebook-play__paused" role="status">
          {LATER_STRINGS.playPaused(trace.pausedAt)}
        </p>
      )}
      {trace.error === undefined ? null : (
        <p className="forgebook-problems" role="alert">
          {trace.error}
        </p>
      )}
      {trace.steps.length === 0 && actions.length === 0 ? (
        <p className="forgebook-prop__description">
          {trace.status === "off" ? LATER_STRINGS.playOff : LATER_STRINGS.playNoSteps}
        </p>
      ) : null}
      {trace.steps.length === 0 ? null : (
        <ol className="forgebook-play__steps">
          {trace.steps.map((step, index) => (
            // a step's place is its identity: a play may name two steps alike
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <li key={index} className="forgebook-play__step" data-status={step.status}>
              <span className="forgebook-play__label">{step.label}</span>
              <StatusNote status={step.status} ms={step.ms} />
              {step.error === undefined ? null : <p className="forgebook-play__error">{step.error}</p>}
              <ActionList actions={actions.filter((action) => action.step === index)} />
            </li>
          ))}
        </ol>
      )}
      <ActionList actions={outside} />
      {actions.length === 0 ? (
        <p className="forgebook-prop__description">{LATER_STRINGS.playActionsNote}</p>
      ) : null}
    </div>
  );
};
