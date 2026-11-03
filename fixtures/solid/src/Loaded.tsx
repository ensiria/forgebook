/**
 * A text read from a resource: what a story waits for before it is drawn.
 *
 * @module
 */
import { createResource, type JSX } from "solid-js";

/** The text, a moment later. */
const later = (): Promise<string> =>
  new Promise((resolve) => {
    setTimeout(() => resolve("Loaded"), 50);
  });

/** The text, once loaded. */
export const Loaded = (): JSX.Element => {
  const [text] = createResource(later);
  return <p data-testid="loaded">{text()}</p>;
};
