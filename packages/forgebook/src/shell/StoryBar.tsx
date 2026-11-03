/**
 * The bar above the shown story: its name and description, the matrix's axes, Replay, a Live story's clock controls,
 * the button that copies its id, the Embed button and the link to its frame alone.
 *
 * @remarks
 * The bar only shows and forwards: the stage decides what the story can do (replay, a clock, a matrix) and owns the
 * frame the actions reach.
 *
 * @module
 */

import type { ReactNode } from "react";

import type { PropDocs } from "../componentDocs.ts";
import type { TreeStory } from "../storyTree.ts";
import { ClockControls, type StoryClockControls } from "./ClockControls.tsx";
import { EmbedButton } from "./EmbedButton.tsx";
import type { EmbedPanelProps } from "./EmbedPanel.tsx";
import { Icon } from "./icons.tsx";
import { MatrixPicker } from "./MatrixPicker.tsx";
import { STRINGS } from "./strings.ts";
import { useCopy } from "./useCopy.ts";

/** The story bar's props. */
export type StoryBarProps = {
  /** The shown story. */
  readonly story: Pick<TreeStory, "id" | "name" | "description">;
  /** The props a matrix can take as an axis; empty hides the picker. */
  readonly axisProps: readonly PropDocs[];
  /** The matrix's chosen axes: the rows' prop, then the columns'. */
  readonly matrixAxes: readonly string[];
  /** Called with the chosen axes. */
  readonly onMatrixAxesChange: (axes: readonly string[]) => void;
  /** Plays the story again; `undefined` hides Replay, for a story that cannot replay or the compare view. */
  readonly onReplay: (() => void) | undefined;
  /** The story's clock controls; `undefined` hides them, for a story without a clock or the compare view. */
  readonly clockControls: StoryClockControls | undefined;
  /** The address of the story's frame alone, in the view shown. */
  readonly frameAddress: string;
  /** What the Embed button offers: the iframe's title, the view and args as a query, the height it starts at. */
  readonly embed: Omit<EmbedPanelProps, "storyId">;
};

/**
 * Copies the story's id (`kit:inputs-selection-select--overview`), the name tests and tools address it by; the id
 * shows as the button's tooltip.
 *
 * @param props - the story's id.
 */
const CopyIdButton = ({ storyId }: { readonly storyId: string }): ReactNode => {
  const { isCopied, copy } = useCopy();
  return (
    <button
      type="button"
      className="forgebook-button forgebook-button--icon"
      title={`${STRINGS.copyStoryId}: ${storyId}`}
      aria-label={isCopied ? STRINGS.copied : STRINGS.copyStoryId}
      onClick={(): void => copy(storyId)}
    >
      <Icon name={isCopied ? "check" : "hash"} size={14} />
    </button>
  );
};

/**
 * The story bar.
 *
 * @param props - the story, the matrix's axes, the actions the story allows, its embed and its frame's address.
 */
export const StoryBar = ({
  story,
  axisProps,
  matrixAxes,
  onMatrixAxesChange,
  onReplay,
  clockControls,
  frameAddress,
  embed
}: StoryBarProps): ReactNode => (
  <div className="forgebook-story__bar">
    <div className="forgebook-stage__heading">
      <h2 className="forgebook-stage__title">{story.name}</h2>
      {story.description === undefined ? null : (
        <p className="forgebook-stage__description" title={story.description}>
          {story.description}
        </p>
      )}
    </div>
    {axisProps.length === 0 ? null : (
      <MatrixPicker props={axisProps} axes={matrixAxes} onAxesChange={onMatrixAxesChange} />
    )}
    {onReplay === undefined ? null : (
      <button type="button" className="forgebook-button" onClick={onReplay}>
        <Icon name="replay" size={14} />
        {STRINGS.replay}
      </button>
    )}
    {clockControls === undefined ? null : <ClockControls controls={clockControls} />}
    <CopyIdButton storyId={story.id} />
    <EmbedButton storyId={story.id} {...embed} />
    <a
      className="forgebook-button forgebook-button--icon"
      href={frameAddress}
      target="_blank"
      rel="noopener"
      title={STRINGS.openFrame}
      aria-label={STRINGS.openFrame}
    >
      <Icon name="external" size={14} />
    </a>
  </div>
);
