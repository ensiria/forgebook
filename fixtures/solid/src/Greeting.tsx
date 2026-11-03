/**
 * A greeting in the shown language, at the story clock's time.
 *
 * @module
 */
import { useStoryNow } from "@forgebook/solid/clock";
import { useStoryText } from "@forgebook/solid/texts";
import type { JSX } from "solid-js";

/** A greeting. */
export const Greeting = (): JSX.Element => {
  const text = useStoryText();
  const now = useStoryNow();
  return (
    <p data-testid="greeting">
      {text("greeting.hello")} {new Date(now()).toISOString()}
    </p>
  );
};
