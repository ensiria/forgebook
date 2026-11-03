/**
 * A frame's one retry when its story's module is stale: after the dev server prepared its dependencies again (a new
 * dependency arrived) or a new build replaced the files, a dynamic import of the old module fails, and reloading the
 * frame fetches the new one.
 *
 * @remarks
 * The frame reloads once per address; the mark lives in `sessionStorage`, so a second failure shows the error instead
 * of reloading forever. Where the storage is unavailable (a private window, blocked site data) the frame does not
 * retry and shows the error.
 *
 * @module
 */

/** How each engine words a dynamic import that failed to load: Chromium, Firefox, WebKit. */
const STALE_MODULE_MESSAGES = [
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Importing a module script failed"
];

/** The key of a frame address's retry mark. */
const markKey = (address: string): string => `forgebook:reloaded:${address}`;

/**
 * Where the frame's load guard counts the reloads of a frame whose code could not be loaded, before the frame's page and
 * story (`loadReloadsKey`).
 */
export const LOAD_RELOADS_KEY = "forgebook:load-reloads:";

/**
 * The key of a frame's count of reloads: its page and its story, not its whole address, which the view's query changes
 * while the frame loads. The page's guard writes the same key.
 *
 * @param address - the frame's address.
 */
export const loadReloadsKey = (address: string): string => {
  // a base for an address given without its origin: only the path and the story are read
  const url = new URL(address, "http://frame.invalid");
  return `${LOAD_RELOADS_KEY}${url.pathname}?story=${url.searchParams.get("story") ?? ""}`;
};

/**
 * Whether an error message is a dynamic import that failed to load.
 *
 * @param message - the error's message.
 */
export const isStaleModuleError = (message: string): boolean =>
  STALE_MODULE_MESSAGES.some((stale) => message.includes(stale));

/**
 * Marks an address as retried, unless it already is.
 *
 * @param storage - the session storage, or `undefined` where it is unavailable.
 * @param address - the frame's address.
 * @returns whether the frame should reload: `false` when it already did, or when there is nowhere to remember it.
 */
export const markRetry = (storage: Storage | undefined, address: string): boolean => {
  if (storage === undefined) return false;
  try {
    if (storage.getItem(markKey(address)) !== null) return false;
    storage.setItem(markKey(address), "1");
    return true;
  } catch {
    return false;
  }
};

/**
 * Forgets an address's retry once its story rendered, so a later stale module gets its retry too, and the load guard's
 * count of reloads.
 *
 * @param storage - the session storage, or `undefined` where it is unavailable.
 * @param address - the frame's address.
 */
export const clearRetry = (storage: Storage | undefined, address: string): void => {
  try {
    storage?.removeItem(markKey(address));
    storage?.removeItem(loadReloadsKey(address));
  } catch {
    // nothing to forget where the storage refuses access
  }
};

/**
 * The window's session storage, or `undefined` where reading it throws.
 *
 * @param target - the frame's window.
 */
export const sessionStorageOf = (target: Window): Storage | undefined => {
  try {
    return target.sessionStorage;
  } catch {
    return undefined;
  }
};
