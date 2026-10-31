/**
 * Card's stories: Badge rendered directly, under another name and inside a scene of the file.
 *
 * @module
 */
import type { ReactNode } from "react";

import { Badge, Badge as Tag } from "./Badge.tsx";
import { Card } from "./Card.tsx";

export default { title: "Layout/Card", component: Card };

/** A scene of the file: its JSX counts for the stories that render it. */
const Scene = (): ReactNode => (
  <Card>
    <Badge label="In a scene" />
  </Card>
);

/** Drawn from its args. */
export const Plain = { args: { children: "Text" } };

/** Badge under another name. */
export const WithBadge = {
  render: (): ReactNode => (
    <Card>
      <Tag label="New" />
    </Card>
  )
};

/** Inside the file's scene. */
export const InScene = { render: (): ReactNode => <Scene /> };
