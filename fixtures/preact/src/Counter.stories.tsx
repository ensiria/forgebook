/**
 * A story with state of its own: new args must not start it over, and a render may keep state in its own hooks.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/preact";
import { useState } from "preact/hooks";

import { Counter } from "./Counter";

export default { title: "Inputs/Counter", component: Counter, args: { label: "Clicks" } } satisfies Meta<
  typeof Counter
>;

/** The counter itself. */
export const Default: Story<typeof Counter> = {};

/** A render with a hook of its own: it runs as a component. */
export const WithHook: Story<typeof Counter> = {
  render: (args) => {
    const [isShown, setShown] = useState(true);
    return (
      <div>
        <button type="button" onClick={() => setShown(!isShown)}>
          {isShown ? "Hide" : "Show"}
        </button>
        {isShown ? <Counter label={args.label ?? ""} /> : null}
      </div>
    );
  }
};
