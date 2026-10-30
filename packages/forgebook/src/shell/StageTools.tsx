/**
 * The zoom and the tools floating on the stage: the story drawn larger or smaller (its layout unchanged), a step at a
 * time, and the tools drawn over it (every element's outline, an 8 px grid, the box under the pointer).
 *
 * @module
 */
import type { ReactNode } from "react";

import { MEASURE_TOOLS, type MeasureTool, ZOOMS, type Zoom } from "../viewState";
import { Icon, type IconName } from "./icons";
import { STRINGS } from "./strings";

/** The tools' props. */
export type StageToolsProps = {
  /** The zoom. */
  readonly zoom: Zoom;
  /** Called with the chosen zoom. */
  readonly onZoomChange: (zoom: Zoom) => void;
  /** The tools on. */
  readonly tools: readonly MeasureTool[];
  /** Called with the tools on, in their order. */
  readonly onToolsChange: (tools: readonly MeasureTool[]) => void;
};

/** Each tool's icon. */
const TOOL_ICONS: Readonly<Record<MeasureTool, IconName>> = {
  outline: "outline",
  grid: "grid",
  measure: "ruler"
};

/**
 * The zoom and the tools, floating at the stage's lower end corner: they change how the story is looked at, not what
 * it gets, so they sit on the stage rather than in the toolbar.
 *
 * @param props - the zoom, the tools and their setters.
 */
export const StageTools = ({ zoom, onZoomChange, tools, onToolsChange }: StageToolsProps): ReactNode => {
  const step = ZOOMS.indexOf(zoom);
  const zoomOut = ZOOMS[step - 1];
  const zoomIn = ZOOMS[step + 1];
  return (
    <div className="forgebook-stage-tools" role="toolbar" aria-label={STRINGS.stageTools}>
      <div className="forgebook-stage-tools__group">
        <button
          type="button"
          className="forgebook-stage-tools__button"
          aria-label={STRINGS.zoomOut}
          title={STRINGS.zoomOut}
          disabled={zoomOut === undefined}
          onClick={(): void => {
            if (zoomOut !== undefined) onZoomChange(zoomOut);
          }}
        >
          <Icon name="minus" size={14} />
        </button>
        <button
          type="button"
          className="forgebook-stage-tools__zoom"
          aria-label={`${STRINGS.zoom} ${zoom}%: ${STRINGS.zoomReset}`}
          title={STRINGS.zoomReset}
          disabled={zoom === 100}
          onClick={(): void => onZoomChange(100)}
        >
          {`${zoom}%`}
        </button>
        <button
          type="button"
          className="forgebook-stage-tools__button"
          aria-label={STRINGS.zoomIn}
          title={STRINGS.zoomIn}
          disabled={zoomIn === undefined}
          onClick={(): void => {
            if (zoomIn !== undefined) onZoomChange(zoomIn);
          }}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <span className="forgebook-stage-tools__divider" />
      <div className="forgebook-stage-tools__group">
        {MEASURE_TOOLS.map((tool) => {
          const isOn = tools.includes(tool);
          return (
            <button
              key={tool}
              type="button"
              className="forgebook-stage-tools__button"
              aria-pressed={isOn}
              title={STRINGS.tools[tool]}
              aria-label={STRINGS.tools[tool]}
              onClick={(): void =>
                onToolsChange(
                  MEASURE_TOOLS.filter((known) => (known === tool ? !isOn : tools.includes(known)))
                )
              }
            >
              <Icon name={TOOL_ICONS[tool]} size={14} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
