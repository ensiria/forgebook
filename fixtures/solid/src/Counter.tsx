/**
 * A button that counts its clicks in a signal of its own, under a label.
 *
 * @module
 */
import { createSignal, type JSX } from "solid-js";

/** The counter's props. */
export type CounterProps = {
  /** The text before the count. */
  readonly label: string;
};

/**
 * A counter.
 *
 * @param props - the counter's props.
 */
export const Counter = (props: CounterProps): JSX.Element => {
  const [clicks, setClicks] = createSignal(0);
  return (
    <button type="button" data-testid="counter" onClick={() => setClicks(clicks() + 1)}>
      {props.label}: {clicks()}
    </button>
  );
};
