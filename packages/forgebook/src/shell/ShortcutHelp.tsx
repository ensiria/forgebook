/**
 * The list of the shell's keys, in a modal dialog, with the switch that turns the keys without a modifier off.
 *
 * @remarks
 * The platform's modal dialog holds the focus, closes on Escape and gives the focus back. A frame keeps its own keys, so
 * the list says these work only outside a story. Loaded when first opened (`useShortcutHelp.tsx`).
 *
 * @module
 */
import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { shownKeys } from "../controlKeys.ts";
import { catalogueControls } from "../toolbarLayout.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { controlLabel } from "./controlLabel.ts";
import { SINGLE_KEYS_STORED } from "./keyboard.ts";
import "./shortcutHelp.scss";
import { textsOfGroup } from "./strings.ts";
import { readStored, writeStored } from "./useStored.ts";
import { readKeys } from "./useToolbarLayout.ts";

/** The list's texts, as shown: Forgebook's, with the catalogue's replacements. */
const HELP_STRINGS = textsOfGroup("shortcuts", {
  title: "Keyboard keys",
  note: "They work while the focus is outside a story: a story keeps every key pressed inside it.",
  search: "Go to the search",
  previous: "Previous story",
  next: "Next story",
  help: "This list",
  close: "Close",
  singleKeys: "Keys without a modifier",
  singleKeysNote: "Off, only the search's key with a modifier stays. This browser remembers it.",
  control: (label: string): string => `Next value of ${label}; Shift for the one before`
});

/** The key with the platform's modifier that goes to the search. */
const searchKey = (): string => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K");

/** The list's props. */
export type ShortcutHelpProps = {
  /** Called when the list closes. */
  readonly onClose: () => void;
};

/**
 * The list.
 *
 * @param props - what to call when it closes.
 */
export const ShortcutHelp = ({ onClose }: ShortcutHelpProps): ReactNode => {
  const catalogue = useCatalogue();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOn, setIsOn] = useState(() => readStored(SINGLE_KEYS_STORED) !== "off");
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  const keys = shownKeys(catalogue.keys, readKeys(readStored(`${catalogue.id}:toolbar-keys`)));
  const controlRows = catalogueControls(catalogue).flatMap((control) => {
    const key = keys[control.id];
    return key === undefined
      ? []
      : [{ keys: [key.toUpperCase()], text: HELP_STRINGS.control(controlLabel(control)) }];
  });
  const rows: readonly { readonly keys: readonly string[]; readonly text: string }[] = [
    { keys: ["/", searchKey()], text: HELP_STRINGS.search },
    { keys: ["["], text: HELP_STRINGS.previous },
    { keys: ["]"], text: HELP_STRINGS.next },
    ...controlRows,
    { keys: ["?"], text: HELP_STRINGS.help }
  ];
  return (
    <dialog ref={dialogRef} className="forgebook-keys" aria-label={HELP_STRINGS.title} onClose={onClose}>
      <h2 className="forgebook-keys__title">{HELP_STRINGS.title}</h2>
      <p className="forgebook-keys__note">{HELP_STRINGS.note}</p>
      <dl className="forgebook-keys__list">
        {rows.map((row) => (
          <div key={row.text} className="forgebook-keys__row">
            <dt>
              {row.keys.map((key) => (
                <kbd key={key} className="forgebook-keys__key">
                  {key}
                </kbd>
              ))}
            </dt>
            <dd>{row.text}</dd>
          </div>
        ))}
      </dl>
      <label className="forgebook-keys__switch">
        <input
          type="checkbox"
          checked={isOn}
          onChange={(event: ChangeEvent<HTMLInputElement>): void => {
            setIsOn(event.target.checked);
            writeStored(SINGLE_KEYS_STORED, event.target.checked ? "on" : "off");
          }}
        />
        <span>
          {HELP_STRINGS.singleKeys}
          <small className="forgebook-keys__note">{HELP_STRINGS.singleKeysNote}</small>
        </span>
      </label>
      <form method="dialog" className="forgebook-keys__foot">
        <button type="submit" className="forgebook-button">
          {HELP_STRINGS.close}
        </button>
      </form>
    </dialog>
  );
};
