/**
 * The story bar's Embed button: a popover with the story's link and code. The button is all the first screen carries;
 * the panel loads the first time it opens.
 *
 * @remarks
 * The panel is placed on the window, not in the story's pane, which scrolls and would clip it: on a short window or
 * with the dock open the pane can be shorter than the panel. Its load is watched here rather than through a suspending
 * component, since the shell has no error boundary and a stale tab after a deployment would lose the whole page.
 *
 * @module
 */
import { type MouseEvent, type ReactNode, type RefObject, useEffect, useLayoutEffect, useState } from "react";

import { useCatalogue } from "./catalogueContext.ts";
import type { EmbedPanel as EmbedPanelComponent, EmbedPanelProps } from "./EmbedPanel.tsx";
import { Icon } from "./icons.tsx";
import { STRINGS } from "./strings.ts";
import { usePopover } from "./usePopover.ts";

/** The room kept between the panel and its button, in CSS px. */
const BUTTON_GAP = 6;

/** The room kept between the panel and the window's edges, in CSS px. */
const WINDOW_MARGIN = 12;

/** The panel's module: on its way, loaded, or lost. */
type PanelLoad = "loading" | "failed" | { readonly panel: typeof EmbedPanelComponent };

/**
 * The panel's module, loaded when it is first needed and tried again each time the panel opens after a failure.
 *
 * @param isNeeded - whether the panel is drawn.
 */
const usePanelLoad = (isNeeded: boolean): PanelLoad => {
  const [load, setLoad] = useState<PanelLoad>("loading");
  useEffect(() => {
    if (!isNeeded) return;
    import("./EmbedPanel.tsx")
      .then(({ EmbedPanel }) => setLoad({ panel: EmbedPanel }))
      .catch(() => setLoad("failed"));
  }, [isNeeded]);
  return load;
};

/**
 * Keeps the panel under its button, its end aligned with the button's, and inside the window whatever its height.
 *
 * @param isDrawn - whether the panel is drawn.
 * @param buttonRef - the button.
 * @param panelRef - the panel.
 */
const usePanelPlace = (
  isDrawn: boolean,
  buttonRef: RefObject<HTMLButtonElement | null>,
  panelRef: RefObject<HTMLDivElement | null>
): void => {
  useLayoutEffect(() => {
    const button = buttonRef.current;
    const panel = panelRef.current;
    if (!isDrawn || button === null || panel === null) return;
    const place = (): void => {
      const { bottom, right } = button.getBoundingClientRect();
      const lowest = window.innerHeight - panel.offsetHeight - WINDOW_MARGIN;
      panel.style.top = `${Math.max(WINDOW_MARGIN, Math.min(bottom + BUTTON_GAP, lowest))}px`;
      const width = document.documentElement.clientWidth;
      const furthest = width - panel.offsetWidth - WINDOW_MARGIN;
      panel.style.right = `${Math.max(WINDOW_MARGIN, Math.min(width - right, furthest))}px`;
    };
    place();
    // it grows as its content loads and as the code gains its script
    const observer = new ResizeObserver(place);
    observer.observe(panel);
    window.addEventListener("resize", place);
    return (): void => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [isDrawn, buttonRef, panelRef]);
};

/**
 * What the popover holds while it loads, once it has, or when it could not.
 *
 * @param props - the panel's load and what it shows.
 */
const PanelContent = ({ load, ...props }: EmbedPanelProps & { readonly load: PanelLoad }): ReactNode => {
  if (load === "loading") return <span className="forgebook-spinner" aria-hidden="true" />;
  if (load === "failed") return <p role="alert">{STRINGS.embedPanelFailed}</p>;
  const { panel: Panel } = load;
  return <Panel {...props} />;
};

/**
 * The button and its panel; nothing where the catalogue turns it off.
 *
 * @param props - what the panel shows.
 */
export const EmbedButton = (props: EmbedPanelProps): ReactNode => {
  const { hasEmbed } = useCatalogue();
  const { isOpen, isDrawn, setIsOpen, buttonRef, panelRef, panelId } = usePopover();
  const load = usePanelLoad(isDrawn);
  usePanelPlace(isDrawn, buttonRef, panelRef);
  if (!hasEmbed) return null;
  return (
    <div className="forgebook-embed-menu">
      <button
        ref={buttonRef}
        type="button"
        className="forgebook-button forgebook-button--icon"
        title={STRINGS.embedStory}
        aria-label={STRINGS.embedStory}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={(event: MouseEvent<HTMLButtonElement>): void => setIsOpen(!isOpen, event)}
      >
        <Icon name="embed" size={14} />
      </button>
      {isDrawn ? (
        <div
          ref={panelRef}
          id={panelId}
          className="forgebook-popover forgebook-popover--embed"
          role="dialog"
          aria-label={STRINGS.embedStory}
        >
          <PanelContent load={load} {...props} />
        </div>
      ) : null}
    </div>
  );
};
