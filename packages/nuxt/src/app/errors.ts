/**
 * Nuxt's error composables in a catalogue: `createError` and `isNuxtError` as Nuxt's, and the error `showError` sets and
 * `useError` returns, kept in the story's store instead of replacing a page with Nuxt's error page.
 *
 * @remarks
 * `showError` is recorded among the story's events, so a story shows what its component would have shown the user.
 *
 * @module
 */
import type { Ref } from "vue";

import {
  createError as createNuxtError,
  isNuxtError as isError,
  type NuxtError,
  type NuxtErrorInput
} from "../nuxtError.ts";
import { useNuxtStore } from "../nuxtStore.ts";

/**
 * An error as Nuxt makes it: from a message, Nuxt's fields, or another error.
 *
 * @param input - the message, the fields or the error.
 */
export const createError = (input: string | NuxtErrorInput | Error): NuxtError => createNuxtError(input);

/**
 * Whether a value is an error Nuxt made.
 *
 * @param value - the value.
 */
export const isNuxtError = (value: unknown): value is NuxtError => isError(value);

/** The error `showError` set, if any. */
export const useError = (): Ref<NuxtError | undefined> => useNuxtStore().error;

/**
 * Shows an error, as Nuxt's error page would: the story's `useError` returns it, and the call is recorded.
 *
 * @param input - the message, the fields or the error.
 * @returns the error.
 */
export const showError = (input: string | NuxtErrorInput | Error): NuxtError => {
  const store = useNuxtStore();
  const error = createNuxtError(input);
  store.error.value = error;
  store.record("showError", [error.statusCode, error.message]);
  return error;
};

/**
 * Clears the error, and goes where `redirect` says.
 *
 * @param options - where to go after.
 */
export const clearError = async (options: { readonly redirect?: string } = {}): Promise<void> => {
  const store = useNuxtStore();
  store.error.value = undefined;
  store.record("clearError", options.redirect === undefined ? [] : [options.redirect]);
  if (options.redirect !== undefined) await store.move(options.redirect, true);
};
