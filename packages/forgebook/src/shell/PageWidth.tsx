/**
 * The width of the pages that list stories, the home and a component's page: contained in a centred column, or the
 * whole width of the page; a reader's choice kept in their browser.
 *
 * @remarks
 * It loads with those pages, never with the first screen: the shell's header keeps an empty place of the button's size
 * beside the stories' picker (`.forgebook-page-width`), which the component's page fills with the button, so the
 * picker stays where it is between a component's page, while its code arrives, and its stories' pages. A story's page
 * has its own width controls on its stage. Each page writes the width on its column (`data-page-width`), where
 * `shell.scss` reads it.
 *
 * @module
 */
import type { ReactNode } from "react";

import { Icon } from "./icons.tsx";
import { LATER_STRINGS } from "./laterStrings.ts";
import { useStored } from "./useStored.ts";

/** How wide the pages that list stories are: in a centred column, or the whole page. */
export type PageWidth = "contained" | "full";

/** The width a stored text holds: contained unless the reader chose the whole page. */
const storedWidth = (stored: string | null): PageWidth => (stored === "full" ? "full" : "contained");

/** The reader's page width and the button that switches it. */
export type PageWidthState = {
  /** The width, for the column's `data-page-width`. */
  readonly width: PageWidth;
  /** The button, pressed while the page is contained. */
  readonly toggle: ReactNode;
};

/**
 * The reader's page width, kept for the next visit, and its button.
 *
 * @returns the width and the button.
 */
export const usePageWidth = (): PageWidthState => {
  const [width, setWidth] = useStored<PageWidth>("page-width", storedWidth, String);
  return {
    width,
    toggle: (
      <button
        type="button"
        className="forgebook-button forgebook-button--icon forgebook-page-width"
        title={LATER_STRINGS.pageContained}
        aria-label={LATER_STRINGS.pageContained}
        aria-pressed={width === "contained"}
        onClick={(): void => setWidth(width === "full" ? "contained" : "full")}
      >
        <Icon name="width" size={14} />
      </button>
    )
  };
};
