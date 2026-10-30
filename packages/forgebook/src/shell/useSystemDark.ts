/**
 * Whether the system prefers a dark appearance, kept current: the `system` theme follows it.
 *
 * @module
 */
import { useSyncExternalStore } from "react";

/** The media query of a dark appearance. */
const DARK = "(prefers-color-scheme: dark)";

/** Listens to the system's appearance. */
const subscribe = (onChange: () => void): (() => void) => {
  const query = window.matchMedia(DARK);
  query.addEventListener("change", onChange);
  return (): void => query.removeEventListener("change", onChange);
};

/** Whether the system prefers dark now. */
const isDarkNow = (): boolean => window.matchMedia(DARK).matches;

/** Whether the system prefers dark; light where there is no window (a test rendering on the server). */
export const useSystemDark = (): boolean => useSyncExternalStore(subscribe, isDarkNow, () => false);
