/**
 * A value that flips, as a signal.
 *
 * @module
 */
import { signal, type WritableSignal } from "@angular/core";

/**
 * A value that flips.
 *
 * @param initial - where it starts.
 * @returns the value, as a signal.
 */
export const injectToggle = (initial = false): WritableSignal<boolean> => signal(initial);
