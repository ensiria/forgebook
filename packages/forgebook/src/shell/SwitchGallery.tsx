/**
 * A switch offered as a gallery (`control: "gallery"`): a button naming the value shown, which opens a menu of the
 * values with their previews.
 *
 * @remarks
 * Only the button is on the first screen: the menu's code, its styles and the previews themselves load when it first
 * opens (`SwitchGalleryPanel.tsx`), so a catalogue pays for its gallery only when a reader asks for it.
 *
 * @module
 */
import type { MouseEvent, ReactNode } from "react";

import { switchValueOf, type ViewSwitch } from "../switches.ts";
import { Icon } from "./icons.tsx";
import { LazyView, lazyModule } from "./lazyModule.tsx";
import type { SwitchGalleryPanelProps, SwitchPreviews } from "./SwitchGalleryPanel.tsx";
import { usePopover } from "./usePopover.ts";

/** The menu's module, loaded when a gallery first opens. */
const PANEL = lazyModule<SwitchGalleryPanelProps>(() =>
  import("./SwitchGalleryPanel.tsx").then((module) => module.SwitchGalleryPanel)
);

/** A gallery's props. */
export type SwitchGalleryProps = {
  /** The switch. */
  readonly each: ViewSwitch;
  /** Whether it sits on the toolbar, after its name, or in a row of the View menu, whose row names it. */
  readonly isOnBar: boolean;
  /** The value shown. */
  readonly value: string;
  /** Called with the chosen value. */
  readonly onValueChange: (value: string) => void;
  /** Whether it is off. */
  readonly isDisabled: boolean;
  /** Why it is off, as its tooltip. */
  readonly disabledNote: string | undefined;
  /** Loads the catalogue's previews; none when it gives none. */
  readonly loadPreviews: (() => Promise<SwitchPreviews>) | undefined;
};

/**
 * A gallery's button, and its menu once open.
 *
 * @param props - the switch, the value shown and its setter.
 */
export const SwitchGallery = ({
  each,
  isOnBar,
  value,
  onValueChange,
  isDisabled,
  disabledNote,
  loadPreviews
}: SwitchGalleryProps): ReactNode => {
  const popover = usePopover();
  const name = switchValueOf(each, value)?.label ?? value;
  return (
    <div className="forgebook-toolbar__control">
      {isOnBar ? (
        <span className="forgebook-toolbar__label" aria-hidden="true">
          {each.label}
        </span>
      ) : null}
      <button
        ref={popover.buttonRef}
        type="button"
        className="forgebook-button"
        aria-label={`${each.label}: ${name}`}
        aria-expanded={popover.isOpen}
        aria-controls={popover.panelId}
        disabled={isDisabled}
        title={isDisabled ? disabledNote : undefined}
        onClick={(event: MouseEvent<HTMLButtonElement>): void => popover.setIsOpen(!popover.isOpen, event)}
      >
        {/* every name in one cell, as a native list: the bar keeps its width from one value to another */}
        <span className="forgebook-gallery-names">
          {each.values.map((option) => (
            <span key={option.value} data-shown={option.value === value ? "" : undefined}>
              {option.label}
            </span>
          ))}
        </span>
        <Icon name="chevronDown" size={12} />
      </button>
      {popover.isDrawn ? (
        <LazyView
          module={PANEL}
          props={{ each, value, onValueChange, popover, loadPreviews }}
          loading={null}
          failed={(message: string): ReactNode => (
            <p className="forgebook-problems" role="alert">
              {message}
            </p>
          )}
        />
      ) : null}
    </div>
  );
};
