/**
 * The day's tasks: a list, one ticked by a press, and the empty state.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react-native-web";
import { waitFor, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";

import { TaskList } from "./TaskList";

/** Three tasks of a harbour's morning. */
const MORNING = [
  { id: "ropes", title: "Check the mooring ropes", isDone: true },
  { id: "fuel", title: "Log the fuel" },
  { id: "forecast", title: "Read the forecast" }
];

export default {
  title: "Today/Task list",
  component: TaskList,
  args: { tasks: MORNING }
} satisfies Meta<typeof TaskList>;

/** The morning's tasks, the first one done. */
export const Morning: Story<typeof TaskList> = {};

/** A press on a task ticks it. */
export const Ticking: Story<typeof TaskList> = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("checkbox", { name: "Log the fuel" }));
    await waitFor(() => {
      if (canvas.getByRole("checkbox", { name: "Log the fuel" }).getAttribute("aria-checked") !== "true")
        throw new Error("The task was not ticked");
    });
  }
};

/** No task: the list says so. */
export const Empty: Story<typeof TaskList> = { args: { tasks: [], emptyText: "All done for today" } };
