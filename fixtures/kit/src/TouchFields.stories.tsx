/**
 * The touch fields' story: what the catalogue's touch tests tap to put a caret in.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react";

import { TouchFields } from "./TouchFields";

export default {
  title: "Interaction/Touch fields",
  component: TouchFields
} satisfies Meta<typeof TouchFields>;

/** Every kind of field, as the touch tests use them. */
export const Overview: Story<typeof TouchFields> = { parameters: { height: 900 } };
