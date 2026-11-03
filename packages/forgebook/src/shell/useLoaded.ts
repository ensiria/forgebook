/**
 * A value a source loads lazily (a story file's docs or code), read into a state the shell can show: loading, the
 * value, nothing to load, or why it failed.
 *
 * @module
 */
import { useEffect, useRef, useState } from "react";

import { RENEWED_MODULE_EVENT, successionOf } from "../hotModules.ts";

/** A lazily loaded value: loading, read, none (the source has no loader for the file), or why it failed. */
export type Loaded<TValue> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly value: TValue }
  | { readonly status: "none" }
  | { readonly status: "error"; readonly message: string };

/**
 * Loads a value when its loader changes, and reads it; on a dev server, the value follows its module's edits.
 *
 * @param load - the source's loader for the file; `undefined` when it has none.
 * @param read - turns what the loader gave into the state: the module's default export is unchecked data.
 */
export const useLoaded = <TValue>(
  load: (() => Promise<unknown>) | undefined,
  read: (value: unknown) => Loaded<TValue>
): Loaded<TValue> => {
  // nothing to load is known at once: a first render that said loading would hold a tab's place for nothing
  const [state, setState] = useState<Loaded<TValue>>(
    load === undefined ? { status: "none" } : { status: "loading" }
  );
  // the reader of the first render: a reader written inline must not load the value again on every render
  const [reader] = useState(() => read);
  // what the loader gave, which a renewed module names as the value it replaces
  const loadedRef = useRef<unknown>(undefined);
  useEffect(() => {
    // a renewal of the value before is no longer this one's
    loadedRef.current = undefined;
    if (load === undefined) {
      setState({ status: "none" });
      return;
    }
    let isCurrent = true;
    setState({ status: "loading" });
    load()
      .then((value) => {
        if (!isCurrent) return;
        loadedRef.current = value;
        setState(reader(value));
      })
      .catch((error: unknown) => {
        if (isCurrent)
          setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return (): void => {
      isCurrent = false;
    };
  }, [load, reader]);
  // an edited file's docs, code or page renew in place on a dev server; a value that is no object names no module
  useEffect(() => {
    const follow = (event: Event): void => {
      const succession = successionOf(event);
      if (succession === undefined) return;
      const { previous, next } = succession;
      if (typeof previous !== "object" || previous === null || previous !== loadedRef.current) return;
      loadedRef.current = next;
      setState(reader(next));
    };
    window.addEventListener(RENEWED_MODULE_EVENT, follow);
    return (): void => window.removeEventListener(RENEWED_MODULE_EVENT, follow);
  }, [reader]);
  return state;
};
