/**
 * The search index of a catalogue: loaded the first time a search asks, a group at a time, so what arrives first is
 * found at once and a package's props, read last, join the results when they come.
 *
 * @module
 */
import type { StorySource } from "@forgebook/story-format/source";
import { useEffect, useState } from "react";

import { isSearchIndex, mergedSearchIndex, type SearchIndex } from "../searchIndex.ts";
import { sourceSearchLoaders } from "../sourceFiles.ts";

/** The index as far as it arrived. */
export type LoadedSearchIndex = {
  /** Each source's index, by its id: what arrived so far. */
  readonly indexes: ReadonlyMap<string, SearchIndex>;
  /** Whether more is on its way. */
  readonly isLoading: boolean;
  /** Whether a part could not be read: the search then answers without it. */
  readonly hasFailed: boolean;
};

/** Nothing loaded. */
const NOTHING: LoadedSearchIndex = { indexes: new Map(), isLoading: true, hasFailed: false };

/** A group's index, or nothing and the news when it cannot be read. */
const readGroup = async (load: () => Promise<unknown>): Promise<SearchIndex | undefined> => {
  try {
    const index = await load();
    return isSearchIndex(index) ? index : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The catalogue's search index.
 *
 * @param sources - the sources, with their loaders.
 * @param isWanted - whether a search asked: nothing loads before.
 */
export const useSearchIndex = (sources: readonly StorySource[], isWanted: boolean): LoadedSearchIndex => {
  const [loaded, setLoaded] = useState<LoadedSearchIndex>(NOTHING);
  useEffect(() => {
    if (!isWanted) return;
    const loads = sources.flatMap((source) =>
      sourceSearchLoaders(source).map((load) => ({ id: source.id, load }))
    );
    const bySource = new Map<string, SearchIndex[]>();
    let isCurrent = true;
    let waiting = loads.length;
    let hasFailed = false;
    const arrive = (id: string, index: SearchIndex | undefined): void => {
      waiting -= 1;
      hasFailed ||= index === undefined;
      if (index !== undefined) bySource.set(id, [...(bySource.get(id) ?? []), index]);
      if (!isCurrent) return;
      const indexes = new Map([...bySource].map(([source, each]) => [source, mergedSearchIndex(each)]));
      setLoaded({ indexes, isLoading: waiting > 0, hasFailed });
    };
    setLoaded({ ...NOTHING, isLoading: loads.length > 0 });
    for (const { id, load } of loads) {
      void readGroup(load).then((index): void => arrive(id, index));
    }
    return (): void => {
      isCurrent = false;
    };
  }, [sources, isWanted]);
  return loaded;
};
