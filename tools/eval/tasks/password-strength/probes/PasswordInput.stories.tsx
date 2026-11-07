/**
 * The task's probe: PasswordInput with its strength meter, written before any run and checked the same way in both
 * arms. Never shown to an agent.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react";

import { PasswordInput } from "./password-input";

export default {
  title: "eval/PasswordInput",
  component: PasswordInput
} satisfies Meta<typeof PasswordInput>;

/** A weak password, the meter on. */
export const Weak: Story<typeof PasswordInput> = {
  args: { showStrength: true, defaultValue: "abc", placeholder: "Password" },
  parameters: { main: true }
};

/** A strong password, the meter on. */
export const Strong: Story<typeof PasswordInput> = {
  args: { showStrength: true, defaultValue: "Tr0ub4dor&3xyz!", placeholder: "Password" }
};
