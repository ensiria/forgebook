/**
 * Play functions the Storybook way: storybook/test's within, userEvent and expect, and the context's own canvas and
 * userEvent that the catalogue hands a play when the project has Testing Library.
 *
 * @module
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

/** A counter: a button that counts its presses. */
const Counter = (): React.ReactNode => {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      {`Pressed ${count}`}
    </button>
  );
};

const meta = { title: "Storybook/Play", component: Counter } satisfies Meta<typeof Counter>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Pressed twice with storybook/test's own helpers. */
export const WithStorybookTest: Story = {
  play: async ({ canvasElement, step }) => {
    const button = within(canvasElement).getByRole("button");
    await step("press twice", async () => {
      await userEvent.click(button);
      await userEvent.click(button);
    });
    await expect(button).toHaveTextContent("Pressed 2");
  }
};

/** Pressed once with the context's canvas and userEvent. */
export const WithContext: Story = {
  play: async ({ canvas, userEvent: events }) => {
    const button = canvas.getByRole("button");
    await events.click(button);
    await expect(button).toHaveTextContent("Pressed 1");
  }
};
