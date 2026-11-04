/**
 * The tab a set of docs tabs shows, shared by every set with the same `syncKey`: picking "pnpm" in one picks it in
 * each, on this page and the next, and the browser keeps it for the next visit.
 *
 * @remarks
 * A set without a name keeps its own choice. A named set whose labels lack the shared choice shows its first tab and
 * leaves the choice alone, so a page that offers only npm never forgets that the reader picked pnpm elsewhere.
 *
 * @module
 */
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

import { useCatalogue } from "./catalogueContext.ts";
import { readStored, writeStored } from "./useStored.ts";

/** The sets that follow each stored name. */
const listeners = new Map<string, Set<() => void>>();

/** The choices picked while the page is open: what a browser that refuses storage still keeps until it closes. */
const picked = new Map<string, string>();

/** The choice under a name: picked on this page, else kept from a visit before. */
const choiceOf = (key: string): string | null => picked.get(key) ?? readStored(key);

/** Subscribes to a stored name's changes. */
const subscribeTo =
  (key: string) =>
  (listener: () => void): (() => void) => {
    const set = listeners.get(key) ?? new Set();
    set.add(listener);
    listeners.set(key, set);
    return (): void => {
      set.delete(listener);
    };
  };

/** A subscription that never fires: a set without a name follows nothing. */
const subscribeToNothing = (): (() => void) => (): void => undefined;

/**
 * The tab a set shows, and how to pick another.
 *
 * @param labels - the set's labels, in order.
 * @param sync - the name the set shares its choice under; none keeps its own.
 * @returns the place of the tab shown, and a function that shows the tab at a place.
 */
export const useSyncedTab = (
  labels: readonly string[],
  sync: string | undefined
): readonly [number, (place: number) => void] => {
  const { id } = useCatalogue();
  const key = sync === undefined ? undefined : `${id}:tabs:${sync}`;
  const [own, setOwn] = useState(0);
  const subscribe = useMemo(() => (key === undefined ? subscribeToNothing : subscribeTo(key)), [key]);
  const shared = useSyncExternalStore(
    subscribe,
    (): string | null => (key === undefined ? null : choiceOf(key)),
    (): null => null
  );
  const sharedPlace = shared === null ? -1 : labels.indexOf(shared);
  const shown = key === undefined ? own : Math.max(0, sharedPlace);
  const pick = useCallback(
    (place: number): void => {
      if (key === undefined) {
        setOwn(place);
        return;
      }
      const label = labels[place];
      if (label === undefined) return;
      picked.set(key, label);
      writeStored(key, label);
      for (const listener of listeners.get(key) ?? []) listener();
    },
    [key, labels]
  );
  return [Math.min(shown, Math.max(0, labels.length - 1)), pick];
};
