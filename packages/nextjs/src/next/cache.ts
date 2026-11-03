/**
 * `next/cache` in a catalogue: revalidation is listed among the story's events, and a cached function runs as it is.
 *
 * @remarks
 * There is no data cache in a story: `unstable_cache` returns the function itself, and `cacheLife`, `cacheTag` and
 * `unstable_noStore` change nothing. What a server action revalidates is what a story wants to see, so
 * `revalidatePath`, `revalidateTag`, `updateTag` and `refresh` are recorded with their arguments.
 *
 * @module
 */
import { currentStore } from "../routeStore.ts";

/**
 * Records a call to the cache.
 *
 * @param name - the function.
 * @param values - its arguments.
 */
const record = (name: string, values: readonly unknown[]): undefined => {
  currentStore().record(`cache.${name}`, values);
  return undefined;
};

/**
 * Revalidates a path's data: recorded.
 *
 * @param path - the path.
 * @param type - `page` or `layout`, for a route.
 */
export const revalidatePath = (path: string, type?: "layout" | "page"): undefined =>
  record("revalidatePath", type === undefined ? [path] : [path, type]);

/**
 * Revalidates a tag's data: recorded.
 *
 * @param tag - the tag.
 * @param profile - the cache profile, from Next.js 16.
 */
export const revalidateTag = (tag: string, profile?: unknown): undefined =>
  record("revalidateTag", profile === undefined ? [tag] : [tag, profile]);

/**
 * Expires a tag's data at once: recorded.
 *
 * @param tag - the tag.
 */
export const updateTag = (tag: string): undefined => record("updateTag", [tag]);

/** Refreshes the client's router from a server action: recorded. */
export const refresh = (): undefined => record("refresh", []);

/**
 * A function whose results Next.js caches: the function itself, since a story has no cache.
 *
 * @param callback - the function.
 */
export const unstable_cache = <TCallback extends (...values: never[]) => Promise<unknown>>(
  callback: TCallback
): TCallback => callback;

/** Opts out of static rendering: nothing to do in a story. */
export const unstable_noStore = (): void => undefined;

/** Sets a `"use cache"` function's lifetime: nothing to do in a story. */
export const cacheLife = (): void => undefined;

/** Tags a `"use cache"` function's data: nothing to do in a story. */
export const cacheTag = (): void => undefined;
