/**
 * A custom control written in React: stars to press, as many as the story's `settings` ask for. It keeps what it draws, and
 * gives the panel an integer.
 *
 * @module
 */
import type { ArgControlProps } from "forgebook/arg-control";
import { type ReactNode, useState } from "react";
import { createRoot } from "react-dom/client";

/** How many stars without `settings`. */
const DEFAULT_STARS = 5;

/** The stars, each a button. */
const Stars = ({ value, onChange, argType }: ArgControlProps): ReactNode => {
  const { settings } = argType;
  const stars =
    typeof settings === "object" &&
    settings !== null &&
    "stars" in settings &&
    typeof settings["stars"] === "number"
      ? settings["stars"]
      : DEFAULT_STARS;
  const [rating, setRating] = useState(typeof value === "number" ? value : 0);
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend style={{ position: "absolute", clipPath: "inset(50%)" }}>{argType.label}</legend>
      {Array.from({ length: stars }, (_, index) => (
        <button
          // biome-ignore lint/suspicious/noArrayIndexKey: a star is its place in the row
          key={index}
          type="button"
          aria-label={`${index + 1} of ${stars}`}
          aria-pressed={index < rating}
          onClick={(): void => {
            setRating(index + 1);
            onChange(index + 1);
          }}
        >
          {index < rating ? "★" : "☆"}
        </button>
      ))}
    </fieldset>
  );
};

/** What its value looks like. */
export const schema = { type: "integer", minimum: 0, maximum: 10 } as const;

/**
 * Draws the stars.
 *
 * @param element - where they are drawn.
 * @param props - the value, how to change it, what the story says.
 * @returns what takes them away.
 */
export const mount = (element: HTMLElement, props: ArgControlProps): (() => void) => {
  const root = createRoot(element);
  root.render(<Stars {...props} />);
  return (): void => root.unmount();
};
