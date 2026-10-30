/**
 * A story drawn as a matrix in its frame: once per value of the rows' prop, and of the columns' when there are two,
 * over the story's args, with each value named at the head of its row and column.
 *
 * @remarks
 * The cells do not run the story's play function: a play drives one story, and twenty plays at once would fight over
 * the focus. The names take the frame's own colours, so the matrix reads in every theme.
 *
 * @module
 */

import { useStoryClock } from "@ensiria/story-format/clock";
import type { StoryContext } from "@ensiria/story-format/csf";
import { useStoryText } from "@ensiria/story-format/texts";
import { type ReactNode, useRef } from "react";

import type { Matrix, MatrixValue } from "../matrix";
import { forcedAttribute, storyElement, untracedStep } from "./storyElement";
import type { LoadedArgs, LoadedStory } from "./storyModule";

/** The matrix's props. */
export type StoryMatrixProps = {
  /** The story. */
  readonly story: LoadedStory;
  /** The story's args, each cell's values over them. */
  readonly args: LoadedArgs;
  /** The axes. */
  readonly matrix: Matrix;
};

/**
 * One cell: the story with the cell's values.
 *
 * @param props - the story and the cell's args.
 */
const MatrixCell = ({
  story,
  args
}: {
  readonly story: LoadedStory;
  readonly args: LoadedArgs;
}): ReactNode => {
  const cellRef = useRef<HTMLDivElement>(null);
  const text = useStoryText();
  // every cell reads the one clock of the frame, so a Live story's cells stay in step
  const clock = useStoryClock();
  const context: StoryContext<LoadedArgs> = {
    args,
    step: untracedStep,
    text,
    clock,
    get canvasElement(): HTMLElement {
      return cellRef.current ?? document.body;
    }
  };
  return (
    <div ref={cellRef} className="forgebook-matrix__story" {...forcedAttribute(story)}>
      {storyElement(story, context)}
    </div>
  );
};

/**
 * The story as a matrix.
 *
 * @param props - the story, its args and the axes.
 */
export const StoryMatrix = ({ story, args, matrix }: StoryMatrixProps): ReactNode => {
  const { rows, columns } = matrix;
  const columnValues: readonly (MatrixValue | undefined)[] = columns?.values ?? [undefined];
  return (
    <div className="forgebook-frame forgebook-matrix" data-layout="padded">
      <table className="forgebook-matrix__table">
        <thead>
          <tr>
            <th scope="col" className="forgebook-matrix__corner">
              {columns === undefined ? rows.name : `${rows.name} \\ ${columns.name}`}
            </th>
            {columnValues.map((column) => (
              <th key={String(column)} scope="col" className="forgebook-matrix__name">
                {column === undefined ? null : String(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.values.map((row) => (
            <tr key={String(row)}>
              <th scope="row" className="forgebook-matrix__name">
                {String(row)}
              </th>
              {columnValues.map((column) => (
                <td key={String(column)} className="forgebook-matrix__cell">
                  <MatrixCell
                    story={story}
                    args={{
                      ...args,
                      [rows.name]: row,
                      ...(columns === undefined || column === undefined ? {} : { [columns.name]: column })
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
