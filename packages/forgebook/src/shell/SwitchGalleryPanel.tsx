/**
 * The menu of a gallery (`control: "gallery"`): each value of a switch with its preview, so a reader sees a look before
 * applying it.
 *
 * @remarks
 * Native radio buttons, as the shell's other menus: one tab stop, the arrow keys move and choose, and a screen reader
 * reads the group and each value's label. The pictures are decoration beside that label, so they are hidden from it.
 * Drawn in the top layer, positioned from its button: inside the View menu, whose rows scroll, it would be clipped.
 * Loaded when a gallery first opens, with the previews (`SwitchGallery.tsx`): their pictures are fetched only then.
 *
 * @module
 */
import {
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useState
} from "react";

import type { SwitchPreview, SwitchValue, ViewSwitch } from "../switches.ts";
import { galleryPlace } from "./galleryPlace.ts";
import { Icon } from "./icons.tsx";
import "./switchGallery.scss";
import type { Popover } from "./usePopover.ts";

/** The catalogue's previews, by switch id then value: the plugin's module, with each picture's address. */
export type SwitchPreviews = Readonly<Record<string, Readonly<Record<string, SwitchPreview>>>>;

/** The menu's props. */
export type SwitchGalleryPanelProps = {
  /** The switch. */
  readonly each: ViewSwitch;
  /** The value shown. */
  readonly value: string;
  /** Called with the chosen value. */
  readonly onValueChange: (value: string) => void;
  /** The button's popover, which opens and closes the menu. */
  readonly popover: Popover;
  /** Loads the catalogue's previews; none when it gives none. */
  readonly loadPreviews: (() => Promise<SwitchPreviews>) | undefined;
};

/**
 * What a value shows: its picture, its colours and font, or, with no preview, its label's first letter, so it still
 * has a place of its own in the grid.
 *
 * @param props - the value and its preview.
 */
const PreviewArt = ({
  option,
  preview
}: {
  readonly option: SwitchValue;
  readonly preview: SwitchPreview | undefined;
}): ReactNode => {
  const [isBroken, setIsBroken] = useState(false);
  if (preview !== undefined && "image" in preview && !isBroken) {
    return (
      <img
        className="forgebook-gallery__image"
        src={preview.image}
        alt=""
        decoding="async"
        onError={(_event: SyntheticEvent<HTMLImageElement>): void => setIsBroken(true)}
      />
    );
  }
  if (preview !== undefined && "swatches" in preview) {
    return (
      <>
        <span className="forgebook-gallery__swatches">
          {preview.swatches.map((colour, index) => (
            // a colour may repeat, and the list never changes order
            // biome-ignore lint/suspicious/noArrayIndexKey: the configuration's list, drawn as it is
            <span key={index} style={{ backgroundColor: colour }} />
          ))}
        </span>
        {preview.font === undefined ? null : (
          // only a name: drawn in that font where the reader has it, in the shell's where not; nothing is fetched
          <span
            className="forgebook-gallery__font"
            style={{ fontFamily: `"${preview.font}", var(--forgebook-font-sans)` }}
          >
            {preview.font}
          </span>
        )}
      </>
    );
  }
  return <span className="forgebook-gallery__letter">{Array.from(option.label)[0]}</span>;
};

/**
 * The menu.
 *
 * @param props - the switch, the value shown and its setter, and the button's popover.
 */
export const SwitchGalleryPanel = ({
  each,
  value,
  onValueChange,
  popover,
  loadPreviews
}: SwitchGalleryPanelProps): ReactNode => {
  const { panelRef, buttonRef, panelId, setIsOpen, closeAfterChoice } = popover;
  const name = useId();
  const [previews, setPreviews] = useState<SwitchPreviews>({});

  useEffect(() => {
    let isCurrent = true;
    // without its previews the menu still works: every value then shows its letter
    loadPreviews?.()
      .then((loaded) => {
        if (isCurrent) setPreviews(loaded);
      })
      .catch(() => undefined);
    return (): void => {
      isCurrent = false;
    };
  }, [loadPreviews]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: both are refs, set once the panel is drawn
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const button = buttonRef.current;
    if (panel === null || button === null) return;
    panel.showPopover();
    const place = (): void => {
      const { top, left } = galleryPlace(button.getBoundingClientRect(), panel.getBoundingClientRect(), {
        width: window.innerWidth,
        height: window.innerHeight
      });
      panel.style.top = `${top}px`;
      panel.style.left = `${left}px`;
    };
    place();
    // the first open arrives after its popover's own focus: the code was still loading
    panel.querySelector<HTMLInputElement>("input:checked")?.focus();
    window.addEventListener("resize", place);
    return (): void => window.removeEventListener("resize", place);
  }, []);

  const closeWithKey = (): void => {
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  // on the way down, wherever the focus is: this menu's alone, so a View menu around it stays open
  // biome-ignore lint/correctness/useExhaustiveDependencies: both it calls read refs and the state's setter
  useEffect(() => {
    const onEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeWithKey();
    };
    document.addEventListener("keydown", onEscape, { capture: true });
    return (): void => document.removeEventListener("keydown", onEscape, { capture: true });
  }, []);

  return (
    <div
      ref={panelRef}
      id={panelId}
      className="forgebook-gallery"
      popover="manual"
      role="dialog"
      aria-label={each.label}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.key === "Enter") closeWithKey();
      }}
    >
      <fieldset className="forgebook-gallery__grid">
        <legend className="forgebook-visually-hidden">{each.label}</legend>
        {each.values.map((option) => (
          <label key={option.value} className="forgebook-gallery__item">
            <input
              type="radio"
              className="forgebook-visually-hidden"
              name={name}
              checked={option.value === value}
              onChange={(): void => onValueChange(option.value)}
              // on the click, so a press on the value already shown closes the menu too
              onClick={closeAfterChoice}
            />
            <span className="forgebook-gallery__preview" aria-hidden="true">
              <PreviewArt option={option} preview={previews[each.id]?.[option.value]} />
            </span>
            <span className="forgebook-gallery__name">
              {option.value === value ? <Icon name="check" size={12} /> : null}
              {option.label}
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
};
