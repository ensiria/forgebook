/**
 * Stories written outside a story file, which a story file re-exports: the catalogue lists them under the file that
 * exports them.
 *
 * @module
 */
import type { StoryObj } from "@storybook/react-vite";

import type { Button } from "./Button";

/** A story kept in a module of its own. */
export const shared: StoryObj<typeof Button> = { args: { label: "From another module" } };
