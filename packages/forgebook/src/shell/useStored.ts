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

import { useCatalogue } from "./catalogueContext";

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
 * A value stored under the name every catalogue shared (`forgebook:<name>`), moved under the catalogue's key: read
 * once, written under the new key, removed from the old one.
 *
 * @param name - the value's name.
 * @param key - the catalogue's key for it.
 * @returns the value moved; none when there was none.
 */
const movedStored = (name: string, key: string): string | null => {
  const old = readStored(`forgebook:${name}`);
  if (old === null) return null;
  writeStored(key, old);
  try {
    window.localStorage.removeItem(`forgebook:${name}`);
  } catch {
    // a browser that refuses the storage keeps nothing anyway
  }
  return old;
};

/**
 * A value kept in this browser.
 *
 * @param name - the value's name (`dock-height`), stored under the catalogue's id (`acme-ui:dock-height`), so two
 *   catalogues on one origin keep their own.
 * @param read - the value a stored text holds, or the default when it holds none.
 * @param write - the text a value is stored as.
 * @returns the value and its setter.
 */
export const useStored = <TValue>(
  name: string,
  read: (stored: string | null) => TValue,
  write: (value: TValue) => string
): [TValue, (value: TValue) => void] => {
  const key = `${useCatalogue().id}:${name}`;
  const [value, setValue] = useState(() => read(readStored(key) ?? movedStored(name, key)));
  const text = write(value);
  useEffect(() => writeStored(key, text), [key, text]);
  return [value, setValue];
};
