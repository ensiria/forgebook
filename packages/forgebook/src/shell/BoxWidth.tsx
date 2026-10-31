/**
 * The width of an example's story while its box fills the page: set by the stage's handles or by the presets and the
 * field in the box's bar, for that box only.
 *
 * @remarks
 * The page's width (the toolbar's, in the address) is not changed: the box over the page is a moment's look, and the
 * other examples keep the width they have. The box starts at the page's width and takes it again when it goes back
 * to its place.
 *
 * @module
 */
import { type ReactNode, useState } from "react";

import type { StageWidth } from "../viewState.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { Icon } from "./icons.tsx";
import { Segmented } from "./Segmented.tsx";
import { STRINGS } from "./strings.ts";
import { WidthField } from "./WidthField.tsx";

/** An example box's width over the page, and what sets it. */
export type BoxWidth = {
  /** The story's width: the box's own over the page, the page's otherwise. */
  readonly width: StageWidth;
  /** Sets the box's own width; none in the list, where the stage shows no handles. */
  readonly onWidthChange: ((width: StageWidth) => void) | undefined;
  /** The width the story really has, in CSS px, for the field. */
  readonly shownWidth: number | undefined;
  /** Called with the width the story really has; none in the list. */
  readonly onShownWidthChange: ((width: number | undefined) => void) | undefined;
};

/**
 * An example box's width over the page.
 *
 * @param isOver - whether the box is over the page.
 * @param pageWidth - the page's width, the toolbar's.
 */
export const useBoxWidth = (isOver: boolean, pageWidth: StageWidth): BoxWidth => {
  const [own, setOwn] = useState<StageWidth | undefined>(undefined);
  const [shownWidth, setShownWidth] = useState<number | undefined>(undefined);
  // back in its place, the box forgets its own width, so it opens at the page's next time
  if (!isOver && own !== undefined) setOwn(undefined);
  return {
    width: isOver ? (own ?? pageWidth) : pageWidth,
    onWidthChange: isOver ? setOwn : undefined,
    shownWidth,
    onShownWidthChange: isOver ? setShownWidth : undefined
  };
};

/**
 * The width's presets and field in the bar of a box over the page.
 *
 * @param props - the box's width and what sets it.
 */
export const BoxWidthControl = ({ boxWidth }: { readonly boxWidth: BoxWidth }): ReactNode => {
  const { widths } = useCatalogue();
  const { width, onWidthChange, shownWidth } = boxWidth;
  if (onWidthChange === undefined) return null;
  return (
    <div className="forgebook-example__width">
      <span className="forgebook-toolbar__icon" title={STRINGS.width}>
        <Icon name="width" size={14} />
      </span>
      <Segmented
        label={STRINGS.width}
        options={[
          { value: "fill", label: STRINGS.widthFill },
          ...widths.map((preset) => ({
            value: preset.width,
            label: preset.label ?? STRINGS.widthPx(preset.width)
          }))
        ]}
        value={width}
        onValueChange={onWidthChange}
        after={<WidthField width={width} shownWidth={shownWidth} onWidthChange={onWidthChange} />}
      />
    </div>
  );
};
