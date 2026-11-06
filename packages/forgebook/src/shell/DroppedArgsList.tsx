/**
 * The note above a story whose address names values it does not take: which ones were left out and why, and a button
 * that removes them from the address. Loaded only for such a link (`DroppedArgsNote.tsx`).
 *
 * @remarks
 * A link may carry values the story never declared (a prop renamed since, or a link crafted to reach an element's
 * attributes): they never reach the frame (`addressArgs.ts`), and the person who opened the link sees that they did
 * not, instead of a story that silently differs from the shared view.
 *
 * @module
 */
import type { ReactNode } from "react";

import type { DroppedArg } from "../addressArgs.ts";
import { LATER_STRINGS } from "./laterStrings.ts";

/** The note's props. */
export type DroppedArgsListProps = {
  /** The values left out. */
  readonly dropped: readonly DroppedArg[];
  /** Removes them from the address; none where nothing can rewrite it (an embed's is its author's). */
  readonly onRemove?: () => void;
};

/**
 * The note.
 *
 * @param props - the values left out and the remover.
 */
export const DroppedArgsList = ({ dropped, onRemove }: DroppedArgsListProps): ReactNode => (
  <div className="forgebook-dropped-args" role="status">
    <p className="forgebook-dropped-args__text">{LATER_STRINGS.droppedArgs}</p>
    <ul className="forgebook-dropped-args__list">
      {dropped.map(({ name, reason }) => (
        <li key={name}>
          <code>{name}</code> {LATER_STRINGS.droppedArgReasons[reason]}
        </li>
      ))}
    </ul>
    {onRemove === undefined ? null : (
      <button type="button" className="forgebook-text-button" onClick={onRemove}>
        {LATER_STRINGS.removeDroppedArgs}
      </button>
    )}
  </div>
);
