/**
 * A button that copies a text: whether it just did, so the button can say "Copied" for a moment.
 *
 * @module
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** How long "Copied" shows on the button, in ms. */
const COPIED_FOR = 1500;

/** What the hook gives a button. */
export type Copy = {
  /** Whether the text was copied a moment ago. */
  readonly isCopied: boolean;
  /** Whether the last copy failed a moment ago: the browser gives no clipboard on plain HTTP, or refused. */
  readonly hasFailed: boolean;
  /** Copies a text to the clipboard. */
  readonly copy: (text: string) => void;
};

/** Copies texts, remembering the last copy for a moment. */
export const useCopy = (): Copy => {
  const [isCopied, setIsCopied] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => (): void => window.clearTimeout(timer.current), []);
  const copy = useCallback((text: string): void => {
    const show = (setShown: (isShown: boolean) => void): void => {
      setShown(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setShown(false), COPIED_FOR);
    };
    // inside a promise, since on plain HTTP the clipboard is not there at all
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(text))
      .then(() => show(setIsCopied))
      .catch(() => show(setHasFailed));
  }, []);
  return { isCopied, hasFailed, copy };
};
