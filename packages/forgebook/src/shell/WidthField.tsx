/**
 * The width field at the end of the toolbar's width presets: the width the story has (measured while it fills the
 * stage), typed over and committed with Enter or by leaving the field; Escape gives the shown width back.
 *
 * @module
 */
import { type ChangeEvent, type KeyboardEvent, type ReactNode, useState } from "react";

import { clampedWidth, type StageWidth } from "../viewState.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { STRINGS } from "./strings.ts";

/** The field's props. */
export type WidthFieldProps = {
  /** The width set in the view. */
  readonly width: StageWidth;
  /** The width the story really has, in CSS px: measured on a story's page; none on a component's page. */
  readonly shownWidth: number | undefined;
  /** Called with a typed width, kept within the catalogue's range. */
  readonly onWidthChange: (width: StageWidth) => void;
  /** Why the width cannot be typed (a device sets it), shown as the field's tooltip; none while it can. */
  readonly disabledNote?: string | undefined;
};

/**
 * The width field.
 *
 * @param props - the set and the shown width, and what a typed width does.
 */
export const WidthField = ({
  width,
  shownWidth,
  onWidthChange,
  disabledNote
}: WidthFieldProps): ReactNode => {
  // the field's text while it is being typed in
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const { widths, widthRange } = useCatalogue();
  const isCustom = width !== "fill" && !widths.some((preset) => preset.width === width);
  const shown = shownWidth ?? (width === "fill" ? undefined : width);
  const commit = (): void => {
    if (draft === undefined) return;
    const typed = Number(draft);
    setDraft(undefined);
    if (draft.trim() !== "" && Number.isFinite(typed)) onWidthChange(clampedWidth(typed, widthRange));
  };
  return (
    <span className="forgebook-width-field" data-custom={isCustom ? "" : undefined}>
      <input
        className="forgebook-width-field__input"
        // a text field with the numeric keyboard: a number field draws spin buttons the presets already do better
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={STRINGS.widthTyped}
        disabled={disabledNote !== undefined}
        title={disabledNote ?? (width === "fill" ? STRINGS.widthFillNote : undefined)}
        placeholder={STRINGS.widthAuto}
        value={draft ?? (shown === undefined ? "" : String(shown))}
        onChange={(event: ChangeEvent<HTMLInputElement>): void => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>): void => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setDraft(undefined);
        }}
      />
      <span className="forgebook-width-field__unit" aria-hidden="true">
        px
      </span>
    </span>
  );
};
