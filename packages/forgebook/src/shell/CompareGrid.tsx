/**
 * The compare view of a story's stage: the story once per value of the compared switches, side by side, each cell
 * labelled; in a device each, when one is shown. Loaded the first time the view is compared (`StageCompare.tsx`).
 *
 * @module
 */
import type { ReactNode } from "react";

import type { TreeStory } from "../storyTree.ts";
import { frameAddress, schemeOf, type ViewState } from "../viewState.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { compareVariants } from "./compareVariants.ts";
import { DeviceSlot, deviceAddress, type FramedDevice, inkScheme } from "./DeviceSlot.tsx";
import { FrameView } from "./FrameView.tsx";
import { useSystemDark } from "./useSystemDark.ts";

/** The compare view's props. */
export type CompareGridProps = {
  /** The story. */
  readonly story: TreeStory;
  /** The frames' accessible title, before each cell's label. */
  readonly title: string;
  /** The view, its compared axes set. */
  readonly view: ViewState;
  /** The frame page's address. */
  readonly frameUrl: string;
  /** The device each cell shows; none for none. */
  readonly framed: FramedDevice | undefined;
  /** Each frame's reported height, by its address. */
  readonly heights: ReadonlyMap<string, number>;
  /** The addresses of the frames that finished loading. */
  readonly settled: ReadonlySet<string>;
  /** The height of a frame before its story reports its own, in CSS px. */
  readonly fallbackHeight: number;
  /** The colour the story's page has in a view. */
  readonly backgroundOf: (view: Pick<ViewState, "switches" | "backdrop">) => string | undefined;
};

/**
 * The compare view's cells.
 *
 * @param props - the story, the view, the device and the frames' reports.
 */
export const CompareGrid = ({
  story,
  title,
  view,
  frameUrl,
  framed,
  heights,
  settled,
  fallbackHeight,
  backgroundOf
}: CompareGridProps): ReactNode => {
  const catalogue = useCatalogue();
  const { switches } = catalogue;
  const isSystemDark = useSystemDark();
  return (
    <div className="forgebook-compare" {...framed?.parts.compareGridProps(framed.drawing)}>
      {compareVariants(view.compare, catalogue).map((variant) => {
        const cellView = variant.viewOf(view);
        // the label (the shell's text) reads on the page's colour, or on the shell's around a device, whose screen
        // has it; the frame draws the backdrop
        const background = backgroundOf({ ...cellView, backdrop: "plain" });
        return (
          <figure
            key={variant.label}
            className="forgebook-compare__cell"
            style={{ backgroundColor: framed === undefined ? background : undefined }}
          >
            <figcaption className="forgebook-compare__label">{variant.label}</figcaption>
            <DeviceSlot
              framed={framed}
              scheme={inkScheme(schemeOf(cellView, switches), isSystemDark)}
              background={background}
            >
              <FrameView
                title={`${title} · ${variant.label}`}
                address={deviceAddress(frameAddress(frameUrl, story.id, cellView, switches), framed)}
                heights={heights}
                settled={settled}
                fallbackHeight={fallbackHeight}
                sceneHeight={story.height}
                fixedHeight={framed?.area.height}
              />
            </DeviceSlot>
          </figure>
        );
      })}
    </div>
  );
};
