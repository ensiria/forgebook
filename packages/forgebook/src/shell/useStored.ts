/**
 * A value this browser keeps for the next visit (the panel's height, the sidebar's width): a convenience of the
 * person, not part of the page an address shares.
 *
 * @remarks
 * Storage may be missing or refused (a private window, blocked site data): the value then lives only as long as the
 * page, and nothing fails.
 *
 * @module
 */
import { useEffect, useState } from "react";

/** The stored text under a key, or none when there is none or storage is refused. */
const readStored = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Keeps a text under a key, when storage allows it. */
const writeStored = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // a refused storage only loses the convenience
  }
};

/**
 * A value kept in this browser.
 *
 * @param key - the storage key (`forgebook:dock-height`).
 * @param read - the value a stored text holds, or the default when it holds none.
 * @param write - the text a value is stored as.
 * @returns the value and its setter.
 */
export const useStored = <TValue>(
  key: string,
  read: (stored: string | null) => TValue,
  write: (value: TValue) => string
): [TValue, (value: TValue) => void] => {
  const [value, setValue] = useState(() => read(readStored(key)));
  const text = write(value);
  useEffect(() => writeStored(key, text), [key, text]);
  return [value, setValue];
};
