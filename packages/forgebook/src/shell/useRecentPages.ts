/**
 * The pages opened last, for the home: kept in this browser, the newest first, a page once.
 *
 * @remarks
 * Only this browser's convenience: never in the address nor shared. A page the tree no longer has (a story renamed)
 * stays stored but the home leaves it out.
 *
 * @module
 */
import { useEffect } from "react";

import { useStored } from "./useStored";

/** A page the home can list: a story's or a component's, by id. */
export type RecentPage = {
  /** Which kind of page. */
  readonly kind: "story" | "component";
  /** The story's or the component's id. */
  readonly id: string;
};

/** The storage key. */
const RECENT_KEY = "forgebook:recent-pages";

/** The most pages kept. */
const MOST_RECENT = 8;

/** Whether a stored value is a recent page. */
const isRecentPage = (value: unknown): value is RecentPage =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  (value.kind === "story" || value.kind === "component") &&
  "id" in value &&
  typeof value.id === "string";

/** The stored pages, or none when the text holds none (another format, a damaged value). */
const storedPages = (stored: string | null): readonly RecentPage[] => {
  if (stored === null) return [];
  try {
    const value: unknown = JSON.parse(stored);
    return Array.isArray(value) ? value.filter(isRecentPage) : [];
  } catch {
    return [];
  }
};

/**
 * The list with a page opened now: first, once, the oldest dropped past the limit.
 *
 * @param pages - the list.
 * @param page - the page opened.
 */
export const withRecentPage = (pages: readonly RecentPage[], page: RecentPage): readonly RecentPage[] =>
  [page, ...pages.filter((known) => known.kind !== page.kind || known.id !== page.id)].slice(0, MOST_RECENT);

/**
 * The pages opened last, recording the shown one.
 *
 * @param shown - the page shown now; none on the home or a missing page.
 */
export const useRecentPages = (shown: RecentPage | undefined): readonly RecentPage[] => {
  const [pages, setPages] = useStored(RECENT_KEY, storedPages, JSON.stringify);
  const kind = shown?.kind;
  const id = shown?.id;
  useEffect(() => {
    if (kind === undefined || id === undefined) return;
    // already the newest: nothing to store, and no new list to render again with
    const [newest] = pages;
    if (newest?.kind === kind && newest.id === id) return;
    setPages(withRecentPage(pages, { kind, id }));
  }, [kind, id, pages, setPages]);
  return pages;
};
