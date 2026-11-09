/**
 * A button that shows only an icon, named for a screen reader: a component whose `icon` prop the kit's icon picker
 * sets in every story, with no `argTypes`.
 *
 * @module
 */
import type { ReactNode } from "react";

import type { IconComponent } from "./icons";

/** The icon button's props. */
export type IconButtonProps = {
  /** The icon it shows. */
  readonly icon: IconComponent;
  /** What it does, for a screen reader. */
  readonly label: string;
};

/**
 * A button that shows only an icon.
 *
 * @param props - its icon and its name.
 */
export const IconButton = ({ icon: Icon, label }: IconButtonProps): ReactNode => (
  <button type="button" aria-label={label} className="kit-icon-button">
    <Icon size={20} />
  </button>
);
