/**
 * Tree's stories, its meta written as a constant.
 *
 * @module
 */
import type { ReactNode } from "react";

import { Tree } from "./Tree.tsx";

const meta: { readonly title: string; readonly component: typeof Tree } = {
  title: "Lists/Tree",
  component: Tree
};
export default meta;

/** Drawn from its args. */
export const Default = { args: { items: ["One", "Two"] } };

/** Rendered by hand. */
export const Custom = { render: (): ReactNode => <Tree items={["Three"]} /> };
