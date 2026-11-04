/**
 * A form without a component of its own, whose stories use the kit's Select: Select's page lists it in "Used in".
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react";

import { Select } from "./Select";

export default {
  title: "Layouts/Form",
  parameters: { design: { figma: "https://www.figma.com/design/FixtureFile123/Kit?node-id=12-34" } }
} satisfies Meta;

/** A sign-up form with a select for the billing period. */
export const Signup: Story = {
  render: () => (
    <form>
      <Select options={["weekly", "monthly"]} />
    </form>
  )
};
