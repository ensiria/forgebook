/**
 * A component that reads a private variable: its story fails as the module loads, and the secret never reaches the
 * page.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/sveltekit";

import SecretReader from "./SecretReader.svelte";

export default {
  title: "States/Secret reader",
  component: SecretReader,
  // it fails by design, so the generated tests leave it out; the shell's tests check how it fails
  tags: ["!test"]
} satisfies Meta<typeof SecretReader>;

/** Refused: `$app/env/private` is the server's. */
export const Refused: Story<typeof SecretReader> = {};
