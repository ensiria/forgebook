/**
 * A greeting in the shown language, at the story clock's time.
 *
 * @module
 */
import { useStoryNow } from "@forgebook/preact/clock";
import { useStoryText } from "@forgebook/preact/texts";

/** A greeting. */
export const Greeting = () => {
  const text = useStoryText();
  const now = useStoryNow();
  return (
    <p data-testid="greeting">
      {text("greeting.hello")} {new Date(now).toISOString()}
    </p>
  );
};
