/**
 * A function a story about logic documents.
 *
 * @module
 */
import { signal, type WritableSignal } from "@angular/core";

/**
 * A value that flips.
 *
 * @param initial - where it starts.
 * @returns the value.
 */
export const injectToggle = (initial = false): WritableSignal<boolean> => signal(initial);
