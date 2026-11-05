/**
 * A draft the catalogue leaves out with a `!` pattern (`forgebook.config.ts`): the shell's tests check that it is never
 * listed.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/nextjs";
import type { ReactNode } from "react";

/** A banner not ready to be shown. */
const DraftBanner = (): ReactNode => <p>Draft banner</p>;

export default { title: "Site/Draft banner", component: DraftBanner } satisfies Meta<typeof DraftBanner>;

/** As drafted. */
export const Default: Story<typeof DraftBanner> = {};
