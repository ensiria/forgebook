/**
 * A greeting for the site's visitor, read from the runtime config: an auto-imported composable that itself uses one.
 *
 * @module
 */
import type { ComputedRef } from "vue";

/**
 * The greeting.
 *
 * @param name - the visitor's name.
 */
export const useGreeting = (name: string): ComputedRef<string> => {
  const config = useRuntimeConfig();
  return computed(() => `Welcome to ${String(config.public["siteName"])}, ${name}`);
};
