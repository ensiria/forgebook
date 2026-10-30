/**
 * A page without a component.
 *
 * @module
 */
import type { Meta, Story } from "@ensiria/story-format/csf";

export default { title: "Foundations/Page" } satisfies Meta;

/** The page. */
export const Page: Story = { render: () => null };
