/**
 * A story whose height keeps moving and that counts how often it is drawn: the frame reports every new height, and a
 * report must not draw the story again.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react";
import { type ReactNode, useEffect, useState } from "react";

export default { title: "Foundations/Growing box" } satisfies Meta;

/** How often the box changes its height, in milliseconds. */
const STEP_MS = 30;

/** The box's height when it starts again, in CSS px. */
const SHORTEST_PX = 80;

/** How far the box grows before it starts again, in CSS px. */
const GROWTH_PX = 200;

/**
 * A box that moves its own height: its state stays inside it, so only a draw of the story counts as one.
 *
 * @param props - how many times the story was drawn.
 */
const GrowingBox = ({ draws }: { readonly draws: number }): ReactNode => {
  const [growth, setGrowth] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setGrowth((current) => (current + 1) % GROWTH_PX), STEP_MS);
    return (): void => clearInterval(timer);
  }, []);
  return (
    <div style={{ height: SHORTEST_PX + growth }}>
      Drawn <output aria-label="Draws">{draws}</output> times
    </div>
  );
};

/** The times the story was drawn in this frame. */
let draws = 0;

/** Draws the box, counting the draw. */
const drawBox = (): ReactNode => {
  draws += 1;
  return <GrowingBox draws={draws} />;
};

/** The box, counting each draw of the story. */
export const Growing: Story = { render: drawBox };

/** The box in the theme the story fixes, whatever the toolbar says. */
export const FixedDark: Story = { globals: { theme: "dark" }, render: drawBox };
