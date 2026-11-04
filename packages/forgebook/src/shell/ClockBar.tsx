/**
 * The story clock's controls, for a Live story: a pause or resume button, Restart, and the speed. Loaded the first time
 * a story with a clock is shown (`ClockControls.tsx`).
 *
 * @module
 */
import type { ReactNode } from "react";

import { CLOCK_RATES, type ClockRate } from "../storyClock.ts";
import type { StoryClockControls } from "./ClockControls.tsx";
import { Icon } from "./icons.tsx";
import { LATER_STRINGS } from "./laterStrings.ts";
import { Segmented } from "./Segmented.tsx";

/** The controls' props. */
export type ClockBarProps = {
  /** The clock's state and what changes it. */
  readonly controls: StoryClockControls;
};

/**
 * The clock's controls: a pause or resume button, Restart, and the speed.
 *
 * @param props - the clock's state and what changes it.
 */
export const ClockBar = ({ controls }: ClockBarProps): ReactNode => {
  const { state, change, restart } = controls;
  const toggleLabel = state.isRunning ? LATER_STRINGS.clockPause : LATER_STRINGS.clockResume;
  return (
    <fieldset className="forgebook-clock">
      <legend className="forgebook-visually-hidden">{LATER_STRINGS.clockLabel}</legend>
      <button
        type="button"
        className="forgebook-button forgebook-button--icon"
        title={toggleLabel}
        aria-label={toggleLabel}
        onClick={(): void => change({ isRunning: !state.isRunning })}
      >
        <Icon name={state.isRunning ? "pause" : "play"} size={14} />
      </button>
      <button type="button" className="forgebook-button" onClick={restart}>
        <Icon name="restart" size={14} />
        {LATER_STRINGS.clockRestart}
      </button>
      <Segmented
        label={LATER_STRINGS.clockSpeed}
        options={CLOCK_RATES.map((rate) => ({ value: rate, label: LATER_STRINGS.clockRate(rate) }))}
        value={state.rate}
        onValueChange={(rate: ClockRate): void => change({ rate })}
      />
    </fieldset>
  );
};
