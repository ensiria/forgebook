/**
 * A boundary the story wrote, inside the one the frame draws every Next.js story in: the story is ready only with what it
 * loads in the page.
 *
 * @module
 */
import { lazy, type ReactNode, Suspense } from "react";

const Quote = lazy(
  () =>
    new Promise<{ readonly default: () => ReactNode }>((resolve) => {
      setTimeout(() => resolve({ default: () => <q data-testid="quote">Late</q> }), 300);
    })
);

export default { title: "Quotes/Late quote" };

/** The quote, loaded after the first drawing. */
export const Default = {
  render: (): ReactNode => (
    <section>
      <Suspense fallback={<i data-testid="fallback">Loading</i>}>
        <Quote />
      </Suspense>
    </section>
  )
};
