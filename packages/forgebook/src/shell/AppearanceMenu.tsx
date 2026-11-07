/**
 * The shell's appearance menu, at the sidebar's foot: a button showing the appearance picked, which opens Light, Dark
 * and System. A preference about the tool, not the story, so it sits outside the View menu.
 *
 * @module
 */
import { type MouseEvent, type ReactNode, useId } from "react";

import type { Appearance } from "../catalogue.ts";
import { Icon, type IconName } from "./icons.tsx";
import { STRINGS } from "./strings.ts";
import type { AppearanceState } from "./useAppearance.ts";
import { usePopover } from "./usePopover.ts";

/** Each appearance's icon. */
const ICONS: Readonly<Record<Appearance, IconName>> = {
  light: "sun",
  dark: "moon",
  system: "monitor",
  story: "eye"
};

/**
 * The appearance menu.
 *
 * @param props - the appearance shown and its setter.
 */
export const AppearanceMenu = ({
  appearance,
  setAppearance,
  offered,
  onShowKeys
}: AppearanceState & {
  /** Opens the list of the shell's keys, which a reader who turned them off reaches here. */
  readonly onShowKeys: () => void;
}): ReactNode => {
  const { isOpen, isDrawn, setIsOpen, closeAfterChoice, buttonRef, panelRef, panelId } = usePopover();
  const name = useId();
  return (
    <div className="forgebook-appearance">
      <button
        ref={buttonRef}
        type="button"
        className="forgebook-button forgebook-button--quiet"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={(event: MouseEvent<HTMLButtonElement>): void => setIsOpen(!isOpen, event)}
      >
        <Icon name={ICONS[appearance]} size={14} />
        {STRINGS.appearanceOf(STRINGS.appearances[appearance])}
      </button>
      {isDrawn ? (
        <div
          ref={panelRef}
          id={panelId}
          className="forgebook-popover forgebook-popover--up"
          role="dialog"
          aria-label={STRINGS.appearance}
        >
          <fieldset className="forgebook-choices">
            <legend className="forgebook-visually-hidden">{STRINGS.appearance}</legend>
            {offered.map((each) => (
              <label key={each} className="forgebook-choice">
                <input
                  type="radio"
                  name={name}
                  checked={each === appearance}
                  onChange={(): void => {
                    setAppearance(each);
                    closeAfterChoice();
                  }}
                />
                <Icon name={ICONS[each]} size={14} />
                {STRINGS.appearances[each]}
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            className="forgebook-button forgebook-button--quiet"
            onClick={(event: MouseEvent<HTMLButtonElement>): void => {
              setIsOpen(false, event);
              onShowKeys();
            }}
          >
            {STRINGS.keys}
          </button>
        </div>
      ) : null}
    </div>
  );
};
