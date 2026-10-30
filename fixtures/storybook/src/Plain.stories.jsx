// A story file in plain JavaScript (JSX), as many Storybook projects have.
import { Button } from "./Button";

export default {
  title: "Storybook/Plain JavaScript",
  component: Button
};

/** Written without types. */
export const Untyped = { args: { label: "From a .jsx file" } };
