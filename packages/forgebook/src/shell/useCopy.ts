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
  /** Copies a text to the clipboard. */
  readonly copy: (text: string) => void;
};

/** Copies texts, remembering the last copy for a moment. */
export const useCopy = (): Copy => {
  const [isCopied, setIsCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => (): void => window.clearTimeout(timer.current), []);
  const copy = useCallback((text: string): void => {
    void navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setIsCopied(false), COPIED_FOR);
    });
  }, []);
  return { isCopied, copy };
};
