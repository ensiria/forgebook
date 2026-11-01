/**
 * A value with its history, for the catalogue's tests of stories about logic: set it, undo, redo.
 *
 * @module
 */
import { useState } from "react";

/** The value and what can be done with its history. */
export type UndoState<TValue> = {
  /** The value now. */
  readonly value: TValue;
  /** Sets a new value; what was undone can no longer be redone. */
  readonly set: (value: TValue) => void;
  /** Goes back one value; nothing when there is none. */
  readonly undo: () => void;
  /** Goes forward one undone value; nothing when there is none. */
  readonly redo: () => void;
  /** Whether there is a value to go back to. */
  readonly canUndo: boolean;
  /** Whether there is an undone value to go forward to. */
  readonly canRedo: boolean;
};

/** A history: the values before, the value now, the values undone. */
type History<TValue> = {
  readonly past: readonly TValue[];
  readonly present: TValue;
  readonly future: readonly TValue[];
};

/**
 * Keeps a value with its history.
 *
 * @param initial - the first value.
 * @param limit - how many values back it keeps.
 * @returns the value now, and how to set, undo and redo it.
 */
export const useUndo = <TValue>(initial: TValue, limit = 50): UndoState<TValue> => {
  const [history, setHistory] = useState<History<TValue>>({ past: [], present: initial, future: [] });
  return {
    value: history.present,
    set: (value: TValue): void =>
      setHistory((current) => ({
        past: [...current.past, current.present].slice(-limit),
        present: value,
        future: []
      })),
    undo: (): void =>
      setHistory((current) => {
        const previous = current.past.at(-1);
        if (previous === undefined) return current;
        return {
          past: current.past.slice(0, -1),
          present: previous,
          future: [current.present, ...current.future]
        };
      }),
    redo: (): void =>
      setHistory((current) => {
        const [next, ...rest] = current.future;
        if (next === undefined) return current;
        return { past: [...current.past, current.present], present: next, future: rest };
      }),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0
  };
};
