/**
 * A form without a component of its own, whose stories use the kit's Select: Select's page lists it in "Used in".
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react";

import { Select } from "./Select";

export default { title: "Layouts/Form" } satisfies Meta;

/** A sign-up form with a select for the billing period. */
export const Signup: Story = {
  render: () => (
    <form>
      <Select options={["weekly", "monthly"]} />
    </form>
  )
};
