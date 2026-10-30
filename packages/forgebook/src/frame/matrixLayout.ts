/**
 * The layout of a story drawn as a matrix: a table with one cell per value of the rows' prop, and of the columns'
 * when there are two, each value named at the head of its row and column.
 *
 * @remarks
 * The frame mounts the story in each cell through the framework; the cells do not run the play function, since a play
 * drives one story and twenty plays at once would fight over the focus. The names take the frame's own colours, so the
 * matrix reads in every theme.
 *
 * @module
 */

import type { Matrix, MatrixValue } from "../matrix";
import { forceStates } from "./storyCanvas";
import type { LoadedArgs, LoadedStory } from "./storyModule";

/** One cell of the matrix: where the story is drawn, and its values over the story's args. */
export type MatrixCell = {
  /** The cell's canvas. */
  readonly canvas: HTMLElement;
  /** The values of the cell's row and column. */
  readonly values: LoadedArgs;
};

/** A matrix laid out: its element and its cells, in reading order. */
export type MatrixLayout = {
  /** The matrix's element, to put in the frame. */
  readonly element: HTMLElement;
  /** Its cells. */
  readonly cells: readonly MatrixCell[];
};

/**
 * An element with a class and, optionally, a text.
 *
 * @param document - the frame's document.
 * @param tag - the element's tag.
 * @param className - its class.
 * @param text - its text; none by default.
 */
const element = <TTag extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: TTag,
  className: string | undefined,
  text?: string
): HTMLElementTagNameMap[TTag] => {
  const created = document.createElement(tag);
  if (className !== undefined) created.className = className;
  if (text !== undefined) created.textContent = text;
  return created;
};

/**
 * A heading of a row or a column.
 *
 * @param document - the frame's document.
 * @param scope - `row` or `col`.
 * @param text - the value it names.
 */
const heading = (document: Document, scope: "row" | "col", text: string): HTMLTableCellElement => {
  const cell = element(document, "th", "forgebook-matrix__name", text);
  cell.scope = scope;
  return cell;
};

/**
 * Lays a story out as a matrix.
 *
 * @param document - the frame's document.
 * @param story - the story, for the states it forces in every cell.
 * @param matrix - the axes.
 */
export const matrixLayout = (document: Document, story: LoadedStory, matrix: Matrix): MatrixLayout => {
  const { rows, columns } = matrix;
  const columnValues: readonly (MatrixValue | undefined)[] = columns?.values ?? [undefined];
  const root = element(document, "div", "forgebook-frame forgebook-matrix");
  root.dataset["layout"] = "padded";
  const table = element(document, "table", "forgebook-matrix__table");
  const headRow = element(document, "tr", undefined);
  const corner = element(
    document,
    "th",
    "forgebook-matrix__corner",
    columns === undefined ? rows.name : `${rows.name} \\ ${columns.name}`
  );
  corner.scope = "col";
  headRow.append(corner);
  for (const column of columnValues)
    headRow.append(heading(document, "col", column === undefined ? "" : String(column)));
  const head = element(document, "thead", undefined);
  head.append(headRow);
  const body = element(document, "tbody", undefined);
  const cells: MatrixCell[] = [];
  for (const row of rows.values) {
    const tableRow = element(document, "tr", undefined);
    tableRow.append(heading(document, "row", String(row)));
    for (const column of columnValues) {
      const cell = element(document, "td", "forgebook-matrix__cell");
      const canvas = element(document, "div", "forgebook-matrix__story");
      forceStates(canvas, story);
      cell.append(canvas);
      tableRow.append(cell);
      cells.push({
        canvas,
        values: {
          [rows.name]: row,
          ...(columns === undefined || column === undefined ? {} : { [columns.name]: column })
        }
      });
    }
    body.append(tableRow);
  }
  table.append(head, body);
  root.append(table);
  return { element: root, cells };
};
