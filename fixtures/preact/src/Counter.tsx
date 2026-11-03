/**
 * A button that counts its clicks in state of its own, under a label.
 *
 * @module
 */
import { useState } from "preact/hooks";

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
export const Counter = ({ label }: CounterProps) => {
  const [clicks, setClicks] = useState(0);
  return (
    <button type="button" data-testid="counter" onClick={() => setClicks(clicks + 1)}>
      {label}: {clicks}
    </button>
  );
};
