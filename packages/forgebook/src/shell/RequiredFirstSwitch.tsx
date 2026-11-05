/**
 * The "Required first" switch in the header of a props table (the API reference, the Props tab): the reader turns the
 * ordering of the required props on or off for every component (`useRequiredFirst.ts`).
 *
 * @module
 */
import type { ChangeEvent, ReactNode } from "react";

import { STRINGS } from "./strings.ts";
import type { RequiredFirstState } from "./useRequiredFirst.ts";

/**
 * The switch.
 *
 * @param props - its state, from `useRequiredFirst`.
 */
export const RequiredFirstSwitch = ({
  state
}: {
  readonly state: Pick<RequiredFirstState, "isOn" | "setIsOn">;
}): ReactNode => (
  <label className="forgebook-required-first" title={STRINGS.requiredFirstHint}>
    <input
      type="checkbox"
      role="switch"
      aria-checked={state.isOn}
      className="forgebook-switch"
      checked={state.isOn}
      onChange={(event: ChangeEvent<HTMLInputElement>): void => state.setIsOn(event.currentTarget.checked)}
    />
    {STRINGS.requiredFirst}
  </label>
);
