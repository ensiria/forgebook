/**
 * The width field at the end of the toolbar's width presets: the width the story has (measured while it fills the
 * stage), typed over and committed with Enter or by leaving the field; Escape gives the shown width back.
 *
 * @module
 */
import { type ChangeEvent, type KeyboardEvent, type ReactNode, useState } from "react";

import { clampedWidth, STAGE_WIDTHS, type StageWidth } from "../viewState";
import { STRINGS } from "./strings";

/** The field's props. */
export type WidthFieldProps = {
  /** The width set in the view. */
  readonly width: StageWidth;
  /** The width the story really has, in CSS px: measured on a story's page; none on a component's page. */
  readonly shownWidth: number | undefined;
  /** Called with a typed width, kept within the stage's range (`STAGE_WIDTH_RANGE`). */
  readonly onWidthChange: (width: StageWidth) => void;
};

/**
 * The width field.
 *
 * @param props - the set and the shown width, and what a typed width does.
 */
export const WidthField = ({ width, shownWidth, onWidthChange }: WidthFieldProps): ReactNode => {
  // the field's text while it is being typed in
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const isCustom = width !== "fill" && !STAGE_WIDTHS.includes(width);
  const shown = shownWidth ?? (width === "fill" ? undefined : width);
  const commit = (): void => {
    if (draft === undefined) return;
    const typed = Number(draft);
    setDraft(undefined);
    if (draft.trim() !== "" && Number.isFinite(typed)) onWidthChange(clampedWidth(typed));
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
        title={width === "fill" ? STRINGS.widthFillNote : undefined}
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
