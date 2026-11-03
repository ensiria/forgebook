/**
 * The story's texts and clock, read with the Angular package's injection functions, and an application provider.
 *
 * @module
 */
import { applicationConfig, type Meta, type Story } from "@forgebook/angular";

import { GREETER, Greeting } from "./greeting.component";

export default {
  title: "States/Greeting",
  component: Greeting,
  decorators: [applicationConfig({ providers: [{ provide: GREETER, useValue: "from Forgebook" }] })]
} satisfies Meta<typeof Greeting>;

/** A Live story: the clock starts at its moment and runs. */
export const Live: Story<typeof Greeting> = { parameters: { clock: { start: "2030-01-01T10:00:00Z" } } };
