/**
 * A value a source loads lazily (a story file's docs or code), read into a state the shell can show: loading, the
 * value, nothing to load, or why it failed.
 *
 * @module
 */
import { useEffect, useState } from "react";

/** A lazily loaded value: loading, read, none (the source has no loader for the file), or why it failed. */
export type Loaded<TValue> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly value: TValue }
  | { readonly status: "none" }
  | { readonly status: "error"; readonly message: string };

/**
 * Loads a value when its loader changes, and reads it.
 *
 * @param load - the source's loader for the file; `undefined` when it has none.
 * @param read - turns what the loader gave into the state: the module's default export is unchecked data.
 */
export const useLoaded = <TValue>(
  load: (() => Promise<unknown>) | undefined,
  read: (value: unknown) => Loaded<TValue>
): Loaded<TValue> => {
  const [state, setState] = useState<Loaded<TValue>>({ status: "loading" });
  // the reader of the first render: a reader written inline must not load the value again on every render
  const [reader] = useState(() => read);
  useEffect(() => {
    if (load === undefined) {
      setState({ status: "none" });
      return;
    }
    let isCurrent = true;
    setState({ status: "loading" });
    load()
      .then((value) => {
        if (isCurrent) setState(reader(value));
      })
      .catch((error: unknown) => {
        if (isCurrent)
          setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return (): void => {
      isCurrent = false;
    };
  }, [load, reader]);
  return state;
};
