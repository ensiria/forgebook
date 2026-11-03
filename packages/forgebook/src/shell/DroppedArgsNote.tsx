/**
 * The note above a story whose address names values it does not take: which ones were left out and why, and a button
 * that removes them from the address.
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
import { STRINGS } from "./strings.ts";

/** The note's props. */
export type DroppedArgsNoteProps = {
  /** The values left out. */
  readonly dropped: readonly DroppedArg[];
  /** Removes them from the address. */
  readonly onRemove: () => void;
};

/**
 * The note; nothing when no value was left out.
 *
 * @param props - the values left out and the remover.
 */
export const DroppedArgsNote = ({ dropped, onRemove }: DroppedArgsNoteProps): ReactNode =>
  dropped.length === 0 ? null : (
    <div className="forgebook-dropped-args" role="status">
      <p className="forgebook-dropped-args__text">{STRINGS.droppedArgs}</p>
      <ul className="forgebook-dropped-args__list">
        {dropped.map(({ name, reason }) => (
          <li key={name}>
            <code>{name}</code> {STRINGS.droppedArgReasons[reason]}
          </li>
        ))}
      </ul>
      <button type="button" className="forgebook-text-button" onClick={onRemove}>
        {STRINGS.removeDroppedArgs}
      </button>
    </div>
  );
