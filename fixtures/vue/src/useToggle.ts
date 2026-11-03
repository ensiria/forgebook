/**
 * A composable, documented by a story about logic.
 *
 * @module
 */
import { type Ref, ref } from "vue";

/**
 * A value that flips.
 *
 * @param start - where it starts.
 * @returns the value.
 */
export const useToggle = (start = false): Ref<boolean> => ref(start);
